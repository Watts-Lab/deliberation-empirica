// Daily auto-subscribe-disabled L3 spec.
//
// Pins the integration contract that the platform disables Daily's
// auto-subscribe-to-tracks behavior after joining (see Call.jsx:195).
// This is a bandwidth optimization that's invisible at the React
// level — only assertable by reading the live callObject's
// `subscribeToTracksAutomatically()` state.
//
// Why it matters: with auto-subscribe enabled, Daily fans every
// participant's tracks to every peer at full quality immediately,
// which doesn't scale past a few participants. The platform
// explicitly opts out and manages subscription scope itself. If
// that opt-out regresses (e.g., a Daily SDK upgrade defaults
// changed), bandwidth blows up silently in production.

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
import {
  bypassEquipmentChecks,
  walkThroughVideoIntro,
  waitForCallMounted,
  dailyDiagSnapshot,
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
    logPrefix: "video-subscribe",
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

test("autoSubscribe: callObject has subscribeToTracksAutomatically=false after join", async ({
  page,
}) => {
  const batchName = `video_subscribe_${Date.now()}`;
  const playerKey = `video_subscribe_p_${Date.now()}`;

  const batchId = await createBatch(admin, {
    batchName,
    assetBaseUrl: stack.urls.cdn.replace(/\/$/, ""),
    treatmentFile: "study.stagebook.yaml",
    customIdInstructions: "none",
    platformConsent: "US",
    consentAddendum: "none",
    debrief: "none",
    checkAudio: true,
    checkVideo: true,
    introSequence: "none",
    treatments: ["video_smoke_1p"],
    payoffs: "equal",
    knockdowns: "none",
    dispatchWait: 1,
    launchDate: "immediate",
    preregRepos: [],
    dataRepos: [],
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
    await waitForCallMounted(page);

    // Call.jsx disables auto-subscribe inside its `joined-meeting`
    // event handler. Poll briefly so we're reading the state after
    // that handler runs (it runs synchronously after join, but we
    // wait for the call to be mounted first which gives it slack).
    await expect
      .poll(
        async () => {
          const snap = await dailyDiagSnapshot(page);
          return snap?.subscribeToTracksAutomatically;
        },
        { timeout: 10_000 },
      )
      .toBe(false);
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
  }
});
