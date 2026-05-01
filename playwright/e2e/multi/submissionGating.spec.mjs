// Submission-gating L3 multi spec. Pins the platform contract that:
//
//   1. A multi-player stage with a submitButton advances ONLY when
//      every player has submitted (or the stage timer expires).
//   2. The timer-expiry path actually fires — even with no player
//      submission, the stage advances when `duration` elapses.
//
// What this catches that lower layers don't:
//   - L1 server-vitest doesn't observe the cross-player synchronization
//     primitive (Empirica's `player.stage.set("submit", true)` →
//     stage advances when the count matches).
//   - L2 stage CTs render in single-player isolation; submit-gating is
//     a 2+ player property.
//   - This spec confirms the loop end-to-end: p1 submits → server holds
//     → p2 submits → both advance simultaneously.
//
// Cypress 01 implicitly exercised this in its omnibus flow but it
// wasn't pinned as a standalone contract; this fills that gap.

import { test, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

import { launchStack } from "../_helpers/empiricaServer.mjs";
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
    logPrefix: "multi-gating",
  });
  admin = await connectAsAdmin({
    tajribaURL: `http://127.0.0.1:${stack.ports.empirica}/query`,
    srtoken: readSrtoken(),
  });
});

test.afterAll(async () => {
  if (stack) await stack.stop();
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

// Same helper as test.spec.mjs's walkToLobby. Inlined to keep this
// spec self-contained; if a third multi spec wants it, extracting to
// a shared helper is easy.
async function walkToLobby(page, playerKey) {
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
}

test("submit gating: stage advances only when both players have submitted", async ({
  browser,
}) => {
  const batchName = `multi_submit_${Date.now()}`;
  const p1Key = `multi_submit_p1_${Date.now()}`;
  const p2Key = `multi_submit_p2_${Date.now()}`;

  const batchId = await createBatch(
    admin,
    batchConfig(batchName, ["multi_2p_submission_two_stages"]),
  );

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const p1 = await ctx1.newPage();
  const p2 = await ctx2.newPage();

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

    await Promise.all([walkToLobby(p1, p1Key), walkToLobby(p2, p2Key)]);

    // Both reach stage 1: gateProbe1 is the prompt rendered there.
    // Use the stagebook element-prompt-{name} testid; both players
    // mount it once they're dispatched into the same game.
    await Promise.all([
      p1
        .locator('[data-testid="element-prompt-gateProbe1"]')
        .waitFor({ state: "visible", timeout: 60_000 }),
      p2
        .locator('[data-testid="element-prompt-gateProbe1"]')
        .waitFor({ state: "visible", timeout: 60_000 }),
    ]);

    // p1 submits. Stage 1 should NOT advance — server holds until
    // p2 also submits. Both players' prompts must remain visible.
    await p1.locator('[data-testid="submitButton"]').click();

    // Wait a beat to confirm no premature advance — give the reactive
    // layer time to deliver any (incorrect) advance to p2 before we
    // assert. 1.5s is more than enough; if the gate is broken, the
    // advance fires within milliseconds.
    await p2.waitForTimeout(1_500);

    // Pin the contract on BOTH sides: neither player advances to stage 2
    // when only one has submitted. p1 typically sees a "waiting for
    // others" view after submit (so gateProbe1 may no longer be
    // visible), but stage 2's prompt must not be present for either
    // player — that's the load-bearing assertion for the gating
    // contract. p2 has not yet submitted so still sees stage 1.
    await expect(
      p1.locator('[data-testid="element-prompt-gateProbe2"]'),
      "p1 must NOT have advanced to stage 2 just because they submitted (collective advance)",
    ).toHaveCount(0);
    await expect(
      p2.locator('[data-testid="element-prompt-gateProbe1"]'),
      "stage 1 must still be rendered for p2 after only p1 has submitted",
    ).toBeVisible();
    await expect(
      p2.locator('[data-testid="element-prompt-gateProbe2"]'),
      "p2 must NOT have advanced to stage 2 before submitting",
    ).toHaveCount(0);

    // p2 submits. Both should now advance to stage 2 together.
    await p2.locator('[data-testid="submitButton"]').click();

    // gateProbe2 (stage 2) should appear for both within the
    // standard reactive-propagation window.
    await Promise.all([
      p1
        .locator('[data-testid="element-prompt-gateProbe2"]')
        .waitFor({ state: "visible", timeout: 30_000 }),
      p2
        .locator('[data-testid="element-prompt-gateProbe2"]')
        .waitFor({ state: "visible", timeout: 30_000 }),
    ]);
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
    await ctx1.close();
    await ctx2.close();
  }
});

test("timer expiry: stage advances when duration elapses with no submission", async ({
  browser,
}) => {
  const batchName = `multi_timer_${Date.now()}`;
  const p1Key = `multi_timer_p1_${Date.now()}`;
  const p2Key = `multi_timer_p2_${Date.now()}`;

  const batchId = await createBatch(
    admin,
    batchConfig(batchName, ["multi_2p_timer_advance"]),
  );

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const p1 = await ctx1.newPage();
  const p2 = await ctx2.newPage();

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

    await Promise.all([walkToLobby(p1, p1Key), walkToLobby(p2, p2Key)]);

    // Both reach the short-timer stage. timerProbe1 is its prompt.
    // Note there's no submitButton on this stage — the only way to
    // leave is the server-driven timer.
    await Promise.all([
      p1
        .locator('[data-testid="element-prompt-timerProbe1"]')
        .waitFor({ state: "visible", timeout: 60_000 }),
      p2
        .locator('[data-testid="element-prompt-timerProbe1"]')
        .waitFor({ state: "visible", timeout: 60_000 }),
    ]);

    // Pin that this really is the timer-expiry path: the stage genuinely
    // has no submitButton. If a future fixture edit accidentally adds
    // one, this assertion fails fast and the test stops claiming to
    // cover timer-driven advance when it's actually covering submit.
    await Promise.all([
      expect(
        p1.locator('[data-testid="submitButton"]'),
        "p1's stage must have no submitButton — fixture should be timer-only",
      ).toHaveCount(0),
      expect(
        p2.locator('[data-testid="submitButton"]'),
        "p2's stage must have no submitButton — fixture should be timer-only",
      ).toHaveCount(0),
    ]);

    // Now wait for the auto-advance. Stage duration is 8s; we give
    // 30s to absorb any startup wobble + reactive propagation on a
    // slow CI runner. Both players should land on stage 2 (timerProbe2).
    await Promise.all([
      p1
        .locator('[data-testid="element-prompt-timerProbe2"]')
        .waitFor({ state: "visible", timeout: 30_000 }),
      p2
        .locator('[data-testid="element-prompt-timerProbe2"]')
        .waitFor({ state: "visible", timeout: 30_000 }),
    ]);
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
    await ctx1.close();
    await ctx2.close();
  }
});
