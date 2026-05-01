// Post-flight report export shape L3 spec.
//
// Pins the shape of `*.postFlightReport.jsonl`, which is an aggregated
// summary written at batch close (closeBatch → postFlightReport).
// Despite the `.jsonl` suffix, the file content is a single JSON
// object with `JSON.stringify(report, null, 2)` formatting — pinning
// that contract explicitly because the suffix mismatch is the kind
// of thing tooling can get wrong.
//
// What this catches that lower layers don't:
//   - L1 server-vitest postFlightReportHelpers.test.js covers the
//     pure aggregation helpers (valueCounts, summarizeNumericArray,
//     etc.) but doesn't observe the orchestration: closeBatch fires
//     postFlightReport which reads the prereg + scienceData JSONLs
//     from disk and writes the aggregate file. A regression that
//     broke the file-read or file-write would slip past unit tests.
//   - No existing e2e reads the postFlightReport file. Smoke / solo
//     cancel / api-driven look at scienceData and payment.jsonl only.
//
// Specifically pins (for a 1-participant run that's stopped mid-game):
//   - Filename is `*.postFlightReport.jsonl` even though contents are
//     a single pretty-printed JSON object (not actual JSONL)
//   - report.preregistrations.total === 1
//   - report.preregistrations.treatmentBreakdown === { solo_1p: 1 }
//   - report.preregistrations.percentComplete === 0 (no completers)
//   - report.participants.total === 1
//   - report.participants.completeIntroSteps === 1
//   - report.participants.enterLobby === 1
//   - report.participants.beginGame === 1
//   - report.participants.complete === 0
//   - report.completedSampleIds === [] (empty, no completers)
//   - report.participants.ipCountryBreakdown.US === 1 (mock)
//   - report.participants.knownVPN.false === 1 (mock returns no VPN)
//   - section timing summaries are objects with min/max/mean/median
//     when there's data (intro), and are absent or empty when there
//     isn't (game stage was cut short, no completion-side timings)

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
    logPrefix: "solo-postflight",
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

test("postFlightReport.jsonl shape: solo run produces aggregated report at batch close with prereg + participant summaries", async ({
  page,
}) => {
  const batchName = `solo_pfr_${Date.now()}`;
  const playerKey = `solo_pfr_p_${Date.now()}`;

  const batchId = await createBatch(admin, batchConfig(batchName, ["solo_1p"]));

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

    // Walk through intro into the game stage.
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

    await page
      .locator('[data-testid="element-prompt-soloPrompt"]')
      .waitFor({ state: "visible", timeout: 60_000 });

    // Stop the batch — closeBatch fires postFlightReport synchronously
    // (`await postFlightReport({ batch })` at callbacks.js:287). Once
    // the batch flips to "terminated", the report file should exist.
    await stopBatch(admin, batchId);
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.status === "terminated",
      { timeoutMs: 10_000 },
    );
    await page.waitForTimeout(2000);

    const files = readdirSync(stack.dataDir);
    const reportFile = files.find(
      (f) => f.endsWith(".postFlightReport.jsonl") && f.includes(batchName),
    );
    expect(
      reportFile,
      `expected a postFlightReport jsonl for batch ${batchName} in ${stack.dataDir}, got: ${files.join(", ")}`,
    ).toBeTruthy();

    // Despite the .jsonl suffix, the file is a SINGLE pretty-printed
    // JSON object — `JSON.stringify(report, null, 2)`. JSON.parse the
    // whole body to confirm it isn't actual JSONL, AND assert the
    // pretty-printing is in fact present (the leading `{` is followed
    // by a newline + 2-space indent on the next key). A regression
    // that switched to compact JSON or to actual JSONL would fail
    // one or both checks.
    const body = readFileSync(join(stack.dataDir, reportFile), "utf8").trim();
    expect(body.length, "postFlightReport file is empty").toBeGreaterThan(0);
    expect(
      body.startsWith('{\n  "'),
      "file should be pretty-printed JSON (JSON.stringify(report, null, 2)) — leading brace, newline, 2-space indent",
    ).toBe(true);
    const report = JSON.parse(body);

    // ── Preregistration summary ────────────────────────────────────
    expect(report.preregistrations).toBeTruthy();
    expect(report.preregistrations.total).toBe(1);
    expect(report.preregistrations.treatmentBreakdown).toEqual({
      solo_1p: 1,
    });
    // No completers in the cancel-mid-game scenario, so percentComplete
    // is 0 (or NaN if the divisor were 0; pin the actual value).
    expect(report.preregistrations.percentComplete).toBe(0);

    // ── Participants section ──────────────────────────────────────
    expect(report.participants).toBeTruthy();
    expect(report.participants.total).toBe(1);
    expect(
      report.participants.completeIntroSteps,
      "participant cleared intro (consent + AC + nickname)",
    ).toBe(1);
    expect(report.participants.enterLobby).toBe(1);
    expect(
      report.participants.beginGame,
      "participant reached the soloPrompt stage so timeGameStarted is set",
    ).toBe(1);
    expect(
      report.participants.complete,
      "no completers in the cancel-mid-game scenario",
    ).toBe(0);

    // ── Country / VPN breakdowns from the mocked connectionInfo ────
    expect(report.participants.ipCountryBreakdown).toEqual({ US: 1 });
    expect(report.participants.knownVPN).toEqual({ false: 1 });

    // ── completedSampleIds is empty (no completers) ────────────────
    expect(report.completedSampleIds).toEqual([]);

    // ── timing structure ────────────────────────────────────────────
    // postFlightReport.timings always populates ALL phase keys (intro,
    // countdown, lobby, game, exit), and each is the result of
    // summarizeNumericArray which returns
    //   { max, min, mean, median }
    // with `null` sentinels for empty input. So every phase key is a
    // 4-field object — never absent, never `{}`, never `null`. Pin
    // both the per-phase shape AND that the no-data sentinel is the
    // four-null record (not, say, an empty object or a missing key)
    // — downstream tooling depends on these keys always being readable.
    expect(report.timings).toBeTruthy();
    const phases = ["intro", "countdown", "lobby", "game", "exit"];
    for (const phase of phases) {
      const t = report.timings[phase];
      expect(t, `report.timings.${phase} must always be present`).toBeTruthy();
      expect(typeof t).toBe("object");
      expect(t).not.toBeNull();
      expect(
        Object.keys(t).sort(),
        `report.timings.${phase} must have the four summary keys`,
      ).toEqual(["max", "mean", "median", "min"]);
    }
    // Intro is the one phase we know has data (participant cleared
    // consent → AC → nickname). The four values should be numbers,
    // not nulls.
    const intro = report.timings.intro;
    for (const k of ["min", "max", "mean", "median"]) {
      expect(
        typeof intro[k],
        `report.timings.intro.${k} should be a number (intro phase has data in this run)`,
      ).toBe("number");
    }
    // Exit is a phase we know has NO data (participant didn't reach
    // playerComplete because the batch was cancelled mid-game). Pin
    // that the empty-input sentinel is the four-null record.
    expect(report.timings.exit).toEqual({
      max: null,
      min: null,
      mean: null,
      median: null,
    });
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
  }
});
