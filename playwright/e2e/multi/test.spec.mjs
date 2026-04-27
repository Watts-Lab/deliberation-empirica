// Multi-participant e2e — flows that need ≥2 simultaneous browser
// participants in the same game. The smoke spec runs two participants
// through a *parallel* happy path but doesn't verify cross-client
// realtime sync of any specific value; this folder is for tests that
// observe the live-subscription bridge between players.
//
// Currently covers shared-element propagation (issue #41): a player
// edits a shared prompt → the other player's DOM reflects the change
// without refreshing. Pair includes a non-shared (per-player) prompt
// to verify the negative case (player A's edit must NOT cross over).
//
// This folder is also a natural future home for cypress 03 retirement
// (text-chat propagation), and shares its multi-page setup pattern
// with #37's dropout-matrix work when that lands.

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
    logPrefix: "multi",
  });
  admin = await connectAsAdmin({
    tajribaURL: `http://127.0.0.1:${stack.ports.empirica}/query`,
    srtoken: readSrtoken(),
  });
});

test.afterAll(async () => {
  if (stack) await stack.stop();
});

const baseBatchConfig = (batchName) => ({
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
  treatments: ["multi_2p_shared"],
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

// Walk a participant from the bare URL through ID form, consent,
// attention check, and nickname. Stops in the lobby — callers wait
// for dispatch into the game stage themselves. Modeled after smoke's
// runParticipant but factored so multiple tests can reuse it.
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

test("shared element: P1's edit propagates to P2; per-player edit does not", async ({
  browser,
}) => {
  const batchName = `multi_shared_${Date.now()}`;
  const p1Key = `multi_p1_${Date.now()}`;
  const p2Key = `multi_p2_${Date.now()}`;

  const batchId = await createBatch(admin, baseBatchConfig(batchName));

  // Two independent browser contexts so each participant has their
  // own session (one localStorage / one playerKey).
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

    // Walk both participants to the lobby in parallel — they need to
    // arrive before the dispatcher matches them into one game.
    await Promise.all([walkToLobby(p1, p1Key), walkToLobby(p2, p2Key)]);

    // Both participants should be dispatched into the same game stage
    // and see the shared prompt. Stagebook renders prompt-named
    // elements with `data-testid="element-prompt-{name}"` once the
    // prompt's markdown body has been fetched. Wait on the actual
    // radio inputs (not just the container) — stagebook briefly
    // renders an "Error loading prompt" placeholder if its first
    // fetch fires before batchConfig propagates, and we want to be
    // past that retry before any clicks.
    const sharedSelector = '[data-testid="element-prompt-sharedColor"]';
    const individualSelector = '[data-testid="element-prompt-individualColor"]';
    await p1.locator(`${sharedSelector} input[value="Blue"]`).waitFor({
      state: "visible",
      timeout: 60_000,
    });
    await p2.locator(`${sharedSelector} input[value="Blue"]`).waitFor({
      state: "visible",
      timeout: 60_000,
    });
    await p1.locator(`${individualSelector} input[value="Red"]`).waitFor({
      state: "visible",
      timeout: 30_000,
    });
    await p2.locator(`${individualSelector} input[value="Red"]`).waitFor({
      state: "visible",
      timeout: 30_000,
    });

    // ---- Positive case: shared edit propagates ----
    // P1 picks "Blue" on the shared prompt.
    await p1.locator(`${sharedSelector} input[value="Blue"]`).click();

    // P2's view of the same prompt should reflect "Blue" without
    // anyone refreshing — Empirica's reactive bridge fires on
    // game-scope attribute changes.
    await expect(
      p2.locator(`${sharedSelector} input[value="Blue"]`),
    ).toBeChecked({ timeout: 10_000 });

    // ---- Negative case: per-player edit stays per-player ----
    // P1 picks "Red" on the individual prompt. P2 must NOT see it.
    await p1.locator(`${individualSelector} input[value="Red"]`).click();
    // P1's own view should reflect their pick.
    await expect(
      p1.locator(`${individualSelector} input[value="Red"]`),
    ).toBeChecked();

    // Give Empirica a beat in case any (incorrect) cross-player sync
    // would happen — then assert P2's individual prompt is still
    // unselected. `expect.poll` would mask the bug; a short fixed
    // wait followed by a single assertion is the right shape.
    await p2.waitForTimeout(2_000);
    await expect(
      p2.locator(`${individualSelector} input[value="Red"]`),
    ).not.toBeChecked();

    // ---- And: independence of individual prompts ----
    // P2 picks a different value on their own individual prompt.
    // P1's individual choice should remain "Red"; P2's should be
    // "Green". Pin both to catch any bidirectional bleed.
    await p2.locator(`${individualSelector} input[value="Green"]`).click();
    await expect(
      p2.locator(`${individualSelector} input[value="Green"]`),
    ).toBeChecked();
    await expect(
      p1.locator(`${individualSelector} input[value="Red"]`),
    ).toBeChecked();
    await expect(
      p1.locator(`${individualSelector} input[value="Green"]`),
    ).not.toBeChecked();
  } finally {
    await ctx1.close();
    await ctx2.close();
    await stopBatch(admin, batchId).catch(() => {});
  }
});
