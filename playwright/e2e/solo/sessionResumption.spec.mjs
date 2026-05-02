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
import { batchConfig } from "../_helpers/batchConfig.mjs";
import { walkToLobby } from "../_helpers/walkParticipant.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(__dirname, "./fixtures");

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

test("session resumption: refresh mid-stage lands back in the same stage with state preserved", async ({
  page,
}) => {
  const batchName = `solo_resume_${Date.now()}`;
  const playerKey = `solo_resume_p_${Date.now()}`;

  const batchId = await createBatch(
    admin,
    batchConfig({ batchName, treatments: ["solo_resumption_2stages"] }),
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

    await walkToLobby(page, { url: stack.urls.player, playerKey });

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
