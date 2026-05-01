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

import { test } from "@playwright/test";
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
import {
  bypassEquipmentChecks,
  walkThroughVideoIntro,
  waitForCallMounted,
} from "../_helpers/videoIntro.mjs";

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
  await bypassEquipmentChecks(page);
});

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
    // checkVideo/checkAudio: true is required to trigger server-side
    // createRoom (callbacks.js:367). Equipment-check intro steps still
    // appear in the UI walk; the helper skips past them via the
    // window.__skipEquipmentChecks bypass.
    checkAudio: true,
    checkVideo: true,
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

    await walkThroughVideoIntro(page, {
      playerUrl: stack.urls.player,
      playerKey,
      nickname: `nick_${playerKey}`,
    });

    // Discussion mounts when chatType==="video". 60s real-WebRTC budget.
    await waitForCallMounted(page, { timeoutMs: 60_000 });
  } finally {
    // Always stop the batch so the server's onGameEnd hook fires
    // closeRoom() and Daily releases the room. Leaked rooms accumulate
    // (no spending cap on free tier) — don't rely on the afterAll alone.
    await stopBatch(admin, batchId).catch(() => {});
  }
});
