// Daily.co video-discussion smoke (L3, real Daily).
//
// Bare-minimum sanity check that the full Daily integration works
// end-to-end against real Daily infrastructure: a single participant
// joins a chatType=video stage, the server creates a real Daily room
// with a real URL, the client browser loads @daily-co/daily-js and
// establishes a WebRTC connection using fake media tracks (--use-fake-
// device-for-media-stream), and the call-lifecycle UI mounts.
//
// What this catches that lower layers don't:
//   - Daily SDK breakage between versions (mocks would never see this)
//   - Server → client room URL handshake regressions
//   - Real WebRTC negotiation issues (codec / signaling) in headless
//   - Daily account / auth misconfiguration
//
// What this does NOT exercise (intentionally — that's the dropout
// L3 spec's job): multi-participant interaction, ReportMissing flow,
// check-in counting, recording lifecycle.
//
// This spec runs only on the gated workflow (playwright_e2e_video.yml,
// nightly + workflow_dispatch). Local invocation needs DAILY_APIKEY
// in your shell env. Tests skip cleanly when it's missing so that a
// no-credentials checkout of the repo still lints and type-checks.

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

let stack;
let admin;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({}, testInfo) => {
  test.skip(
    !process.env.DAILY_APIKEY ||
      process.env.DAILY_APIKEY === "none" ||
      process.env.DAILY_APIKEY === "undefined",
    "DAILY_APIKEY missing — video specs only run in the gated workflow",
  );
  stack = await launchStack({
    workerIndex: testInfo.workerIndex,
    fixtureDir,
    logPrefix: "video-smoke",
    // Opt out of the Daily mock so createRoom hits real api.daily.co
    // and the browser-side SDK can establish a real WebRTC session
    // against the room URL the server returns. The whole point of
    // this gated workflow.
    realDaily: true,
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

const ATTENTION_SENTENCE =
  "I agree to participate in this study to the best of my ability.";

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

test("video smoke: 1-player joins a real Daily room and the call lifecycle mounts", async ({
  page,
}) => {
  const batchName = `video_smoke_${Date.now()}`;
  const playerKey = `video_smoke_p_${Date.now()}`;

  const batchId = await createBatch(admin, {
    batchName,
    cdn: "test",
    treatmentFile: "study.treatments.yaml",
    customIdInstructions: "none",
    platformConsent: "US",
    consentAddendum: "none",
    debrief: "none",
    // Equipment checks off — we're testing the in-game video call, not
    // the equipment-check flow.
    checkAudio: false,
    checkVideo: false,
    introSequence: "none",
    treatments: ["video_smoke_1p"],
    payoffs: "equal",
    knockdowns: "none",
    dispatchWait: 1,
    launchDate: "immediate",
    centralPrereg: false,
    preregRepos: [],
    dataRepos: [],
    // Recording disabled — keeps the per-run cost to ~1 participant-minute
    // (no $0.013/min recording charge). Recording-specific specs opt in.
    videoStorage: "none",
    exitCodes: "none",
  });

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

    // The Discussion component mounts a VideoCall when chatType==="video".
    // Wait for any of the four tile testids client/.../call/Tile.jsx
    // can render (callTile when video is live, videoMutedTile / audioOnlyTile
    // when tracks are degraded but the session is up, waitingParticipantTile
    // when peers haven't joined). With fake media tracks the local
    // participant should land on `callTile` — but matching a broader set
    // makes the smoke robust against codec / negotiation variance.
    //
    // 60s timeout because real WebRTC negotiation against Daily can take
    // 5-15s on a cold connection. The 30s spec timeout from the default
    // e2e config would race this on slow CI runners.
    const tile = page
      .locator(
        '[data-testid="callTile"], [data-testid="videoMutedTile"], [data-testid="audioOnlyTile"], [data-testid="waitingParticipantTile"]',
      )
      .first();
    await tile.waitFor({ state: "visible", timeout: 60_000 });
  } finally {
    // Always stop the batch so the server's onGameEnd hook fires
    // closeRoom() and Daily releases the room. Leaked rooms accumulate
    // (no spending cap on free tier) — don't rely on the afterAll alone.
    await stopBatch(admin, batchId).catch(() => {});
  }
});
