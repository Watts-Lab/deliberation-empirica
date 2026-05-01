// Multi-stage prompt round-trip L3 spec.
//
// Pins that a single participant who submits prompts in TWO sequential
// game stages produces a scienceData row where both prompt values
// are correctly attributed to their distinct prompt names. Specifically:
//
//   prompts.prompt_<stage1Name>.value === <stage1 typed text>
//   prompts.prompt_<stage2Name>.value === <stage2 typed text>
//
// What this catches that lower layers don't:
//   - Smoke spec pins per-row prompt values for ONE-stage 2-player
//     scenarios. Multi-stage with same-participant prompt accumulation
//     is not covered.
//   - The session-resumption spec (#88) walks through 2 stages but
//     does not read scienceData — it only verifies stage stickiness
//     across refresh.
//   - L1 stagebookAdapter helpers tests cover `save("prompt_X", ...)`
//     in isolation but don't observe whether stage advance correctly
//     preserves stage 1's value when stage 2 is mounted (a regression
//     where stage advance flushes player.set keys would clobber
//     stage 1's prompt with empty content).
//   - Stage-coherence tests focus on the gate around stage transitions
//     but don't pin the post-export shape.
//
// Notable contract pinned here that's NOT obvious from reading code:
//   - Distinct prompt names DO produce distinct keys in `prompts.*`
//     (a key-collision bug would surface as one of them missing or
//     overwritten).
//   - The two values are attributed correctly; a regression that
//     swapped them (e.g. last-write-wins on a shared key) would fail.

import { test, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, resolve, join } from "path";
import { readdirSync, readFileSync } from "fs";

import { launchStack } from "../_helpers/empiricaServer.mjs";
import { installBrowserMocks } from "../_helpers/installBrowserMocks.mjs";
import {
  connectAsAdmin,
  readSrtoken,
  createBatch,
  startBatch,
  stopBatch,
  waitForAttribute,
} from "../_helpers/empiricaAdminAPI.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(__dirname, "./fixtures");

const ATTENTION_SENTENCE =
  "I agree to participate in this study to the best of my ability.";

let stack;
let admin;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({}, testInfo) => {
  stack = await launchStack({
    workerIndex: testInfo.workerIndex,
    fixtureDir,
    logPrefix: "solo-multistage",
  });
  admin = await connectAsAdmin({
    tajribaURL: `http://127.0.0.1:${stack.ports.empirica}/query`,
    srtoken: readSrtoken(),
  });
});

test.afterAll(async () => {
  if (stack) await stack.stop();
});

test.beforeEach(async ({ page }) => {
  await installBrowserMocks(page.context());
});

const batchConfig = (batchName, treatments) => ({
  batchName,
  cdn: "test",
  treatmentFile: "study.treatments.yaml",
  customIdInstructions: "none",
  platformConsent: "US",
  consentAddendum: "none",
  debrief: "none",
  checkAudio: false,
  checkVideo: false,
  introSequence: "none",
  treatments,
  payoffs: "equal",
  knockdowns: "none",
  dispatchWait: 1,
  launchDate: "immediate",
  centralPrereg: false,
  preregRepos: [],
  dataRepos: [],
  videoStorage: "none",
  exitCodes: "none",
});

test("multi-stage prompts: distinct values in two stages both round-trip into scienceData under their respective prompt names", async ({
  page,
}) => {
  const batchName = `solo_multistage_${Date.now()}`;
  const playerKey = `multistage_p_${Date.now()}`;
  // Use distinct strings per stage so we can attribute correctly in
  // the assertions and a swap regression would be visible.
  const stage1Response = `stage1_response_${Date.now()}`;
  const stage2Response = `stage2_response_${Date.now()}`;

  // solo_resumption_2stages was added by PR #88 — two stages with
  // openResponse prompts named resumeProbe1 / resumeProbe2 (both
  // backed by hello.prompt.md). It's the only existing solo treatment
  // with two input-bearing game stages, so reuse it rather than
  // inventing yet another fixture.
  const batchId = await createBatch(
    admin,
    batchConfig(batchName, ["solo_resumption_2stages"]),
  );

  try {
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.initialized === true,
      { timeoutMs: 30_000 },
    );
    await startBatch(admin, batchId);
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.status === "running",
      { timeoutMs: 5_000 },
    );

    // Walk through intro.
    await page.goto(`${stack.urls.player}?playerKey=${playerKey}`, {
      waitUntil: "load",
    });

    const idInput = page.locator('input[data-testid="inputPaymentId"]');
    await idInput.waitFor({ state: "visible", timeout: 30_000 });
    await idInput.fill(playerKey);
    await page.locator('button[data-testid="joinButton"]').click();

    const consentBtn = page.locator('button[data-testid="consentButton"]');
    await consentBtn.waitFor({ state: "visible", timeout: 30_000 });
    await consentBtn.click();

    const attnInput = page.locator('input[data-testid="inputAttentionCheck"]');
    await attnInput.waitFor({ state: "visible", timeout: 15_000 });
    await attnInput.pressSequentially(ATTENTION_SENTENCE, { delay: 1 });
    await page.locator('button[data-testid="continueAttentionCheck"]').click();

    const nickInput = page.locator('input[data-testid="inputNickname"]');
    await nickInput.waitFor({ state: "visible", timeout: 15_000 });
    await nickInput.fill(`nick_${playerKey}`);
    await page.locator('button[data-testid="continueNickname"]').click();

    // ── Stage 1 ─────────────────────────────────────────────────────
    // resumeProbe1's openResponse prompt should render. Wait on the
    // textarea (not the prompt container) because stagebook openResponse
    // can render the container before the body finishes — same
    // pattern as smoke spec.
    const stage1Textarea = page.locator(
      '[data-testid="element-prompt-resumeProbe1"] textarea',
    );
    await stage1Textarea.waitFor({ state: "visible", timeout: 60_000 });
    await stage1Textarea.fill(stage1Response);
    // Stagebook openResponse debounces text saves at 2000ms; wait past
    // it so the value reaches Empirica state before submit.
    await page.waitForTimeout(2500);
    await page.locator('[data-testid="submitButton"]').click();

    // ── Stage 2 ─────────────────────────────────────────────────────
    const stage2Textarea = page.locator(
      '[data-testid="element-prompt-resumeProbe2"] textarea',
    );
    await stage2Textarea.waitFor({ state: "visible", timeout: 30_000 });
    // Pin: stage 1's prompt must NOT also still be rendering — that
    // would mean we never advanced.
    await expect(
      page.locator('[data-testid="element-prompt-resumeProbe1"]'),
      "stage 1's prompt must be torn down once stage 2 mounts",
    ).toHaveCount(0);
    await stage2Textarea.fill(stage2Response);
    await page.waitForTimeout(2500);
    await page.locator('[data-testid="submitButton"]').click();

    // Stop the batch — at this point the player has either advanced
    // past both stages (heading toward exit-sequence/QC) or is still
    // mid-stage-2 transition. Either way, exitStatus="incomplete"
    // and closeOutPlayer flushes scienceData with both prompt values
    // collected before we tore down.
    await stopBatch(admin, batchId);
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.status === "terminated",
      { timeoutMs: 10_000 },
    );
    await page.waitForTimeout(2000);

    const files = readdirSync(stack.dataDir);
    const scienceFile = files.find(
      (f) => f.endsWith(".scienceData.jsonl") && f.includes(batchName),
    );
    expect(
      scienceFile,
      `expected a scienceData jsonl for batch ${batchName} in ${stack.dataDir}, got: ${files.join(", ")}`,
    ).toBeTruthy();

    const body = readFileSync(join(stack.dataDir, scienceFile), "utf8").trim();
    const rows = body
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    expect(rows.length, "expected exactly one solo participant row").toBe(1);
    const row = rows[0];

    // The load-bearing assertions: both prompts present with the
    // right values attributed to each.
    expect(row.prompts).toBeTruthy();
    expect(
      row.prompts.prompt_resumeProbe1?.value,
      "stage 1 prompt value must round-trip into prompts.prompt_resumeProbe1",
    ).toBe(stage1Response);
    expect(
      row.prompts.prompt_resumeProbe2?.value,
      "stage 2 prompt value must round-trip into prompts.prompt_resumeProbe2",
    ).toBe(stage2Response);

    // Pin no key collision — if both ended up under the same key
    // (e.g. last-write-wins), one of the above would have failed
    // already, but make the boundary explicit.
    expect(
      Object.keys(row.prompts).filter((k) => k.startsWith("prompt_resume")).sort(),
      "both distinct prompt names should produce two distinct keys",
    ).toEqual(["prompt_resumeProbe1", "prompt_resumeProbe2"]);
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
  }
});
