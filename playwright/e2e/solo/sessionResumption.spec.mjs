// Session-resumption L3 spec. Pins the contract that a participant
// who refreshes mid-stage lands back in the same stage with state
// preserved (not back at consent / nickname / stage 0).
//
// What this catches that lower layers don't:
//   - L1/L2 don't observe the cross-tab session protocol — Empirica's
//     `playerKey` URL param is what re-binds a refreshing browser to
//     the existing session. Server-side `participantData` JSONL +
//     in-memory player state are the durable backing; this test
//     confirms the loop end-to-end.
//   - The previous solo "returning participant" test (test.spec.mjs)
//     covers ACROSS-session resumption (pre-staged JSONL → revisit).
//     This covers WITHIN-session refresh, which is the more common
//     real-world case (participant accidentally refreshes / network
//     blip → must not lose their place).
//
// Cypress 07 (Returning_Player) was retired without this specific
// branch landing as its own e2e — the existing solo test only
// asserts the deliberationId surfaces, not the stage-stickiness.

import { test, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

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
    logPrefix: "solo-resumption",
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

// Solo intro walk: ID form → consent → AC → nickname → game stage.
async function walkToGame(page, playerKey, nickname) {
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
  await nickInput.fill(nickname);
  await page.locator('button[data-testid="continueNickname"]').click();
}

test("session resumption: refresh mid-stage lands back in the same stage with state preserved", async ({
  page,
}) => {
  const batchName = `solo_resume_${Date.now()}`;
  const playerKey = `solo_resume_p_${Date.now()}`;

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

    await walkToGame(page, playerKey, `nick_${playerKey}`);

    // Confirm we're in stage 1 (resumeProbe1 prompt is what stage 1
    // renders; resumeProbe2 belongs to stage 2 and must not appear).
    const stage1 = page.locator('[data-testid="element-prompt-resumeProbe1"]');
    const stage2 = page.locator('[data-testid="element-prompt-resumeProbe2"]');
    await stage1.waitFor({ state: "visible", timeout: 60_000 });
    await expect(stage2, "stage 2 must not be rendered yet").toHaveCount(0);

    // Refresh mid-stage. The bare URL with the same playerKey is what
    // the participant's browser would re-visit on a tab close + reopen
    // OR a manual refresh — same in-session resumption path.
    await page.reload({ waitUntil: "load" });

    // After reload the participant must land back in stage 1, not at
    // consent / nickname / a fresh intro / stage 2. Wait up to 30s
    // for the reactive layer to re-establish state on a slow runner.
    await stage1.waitFor({ state: "visible", timeout: 30_000 });
    await expect(
      stage2,
      "stage 2 must NOT have rendered after refresh — that would mean state was lost or auto-advanced",
    ).toHaveCount(0);

    // Belt-and-braces: the IdForm should NOT have come back. If session
    // resumption regresses to "treat refresh as fresh visit", the
    // ID-collection input would re-render.
    await expect(
      page.locator('input[data-testid="inputPaymentId"]'),
      "IdForm must not re-render on refresh — that would mean playerKey re-binding broke",
    ).toHaveCount(0);

    // Belt-and-braces #2: Confirm the participant can still submit and
    // advance — i.e., resumed session is functionally interactive,
    // not just visually restored.
    await page.locator('[data-testid="submitButton"]').click();
    await page
      .locator('[data-testid="element-prompt-resumeProbe2"]')
      .waitFor({ state: "visible", timeout: 30_000 });
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
  }
});
