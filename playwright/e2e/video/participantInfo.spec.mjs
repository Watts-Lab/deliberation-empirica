// Daily participant-info propagation L3 spec.
//
// Pins the integration contract that the platform-assigned `position`
// reaches Daily as `userData` on join AND propagates to every peer's
// `participants()` map. This is non-trivial integration glue: if the
// platform stops passing position, OR if Daily-react's userData
// translation breaks, OR if the dispatcher assigns positions in an
// unexpected order, multi-player video discussion features that key
// on position (tile placement, transcripts, per-position element
// visibility) silently degrade.
//
// What this catches that L1/L2 don't:
//   - L1 covers the server's createRoom request shape, not what the
//     client passes to Daily on join.
//   - L2's mocked-Daily CTs verify the React lifecycle but don't
//     observe what Daily echoes back to peers — the mock just stores
//     what it received.
//   - This spec confirms the loop: platform → Daily → all peers, with
//     real Daily relaying.

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
    logPrefix: "video-pinfo",
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

test("participantInfo: position propagates as Daily userData; all 3 peers see all 3 positions", async ({
  browser,
}) => {
  const batchName = `video_pinfo_${Date.now()}`;
  const p1Key = `video_pinfo_p1_${Date.now()}`;
  const p2Key = `video_pinfo_p2_${Date.now()}`;
  const p3Key = `video_pinfo_p3_${Date.now()}`;

  const batchId = await createBatch(admin, {
    batchName,
    assetBaseUrl: stack.urls.cdn.replace(/\/$/, ""),
    treatmentFile: "study.treatments.yaml",
    customIdInstructions: "none",
    platformConsent: "US",
    consentAddendum: "none",
    debrief: "none",
    checkAudio: true,
    checkVideo: true,
    introSequence: "none",
    treatments: ["video_dropout_3p"],
    payoffs: "equal",
    knockdowns: "none",
    dispatchWait: 1,
    launchDate: "immediate",
    preregRepos: [],
    dataRepos: [],
    videoStorage: "none",
    exitCodes: "none",
  });

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const ctx3 = await browser.newContext();
  const p1 = await ctx1.newPage();
  const p2 = await ctx2.newPage();
  const p3 = await ctx3.newPage();

  try {
    await Promise.all([
      installBrowserMocks(ctx1),
      installBrowserMocks(ctx2),
      installBrowserMocks(ctx3),
    ]);
    await Promise.all([
      bypassEquipmentChecks(p1),
      bypassEquipmentChecks(p2),
      bypassEquipmentChecks(p3),
    ]);

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

    await Promise.all([
      walkThroughVideoIntro(p1, {
        playerUrl: stack.urls.player,
        playerKey: p1Key,
        nickname: `nick_${p1Key}`,
      }),
      walkThroughVideoIntro(p2, {
        playerUrl: stack.urls.player,
        playerKey: p2Key,
        nickname: `nick_${p2Key}`,
      }),
      walkThroughVideoIntro(p3, {
        playerUrl: stack.urls.player,
        playerKey: p3Key,
        nickname: `nick_${p3Key}`,
      }),
    ]);

    await Promise.all([
      waitForCallMounted(p1),
      waitForCallMounted(p2),
      waitForCallMounted(p3),
    ]);

    // Wait until each browser's `participants()` map sees all 3 peers.
    // Daily's signaling-plane peer-presence propagation can take a
    // second or two after join; poll up to 30s.
    await expect
      .poll(
        async () => {
          const snaps = await Promise.all([
            dailyDiagSnapshot(p1),
            dailyDiagSnapshot(p2),
            dailyDiagSnapshot(p3),
          ]);
          return snaps.map((s) => s?.participants?.length ?? 0);
        },
        { timeout: 30_000 },
      )
      .toEqual([3, 3, 3]);

    // Every browser sees positions {0, 1, 2} across the participants
    // map. We don't assert WHICH peer has which position — the
    // dispatcher picks; the contract is that whatever the dispatcher
    // picked round-trips through Daily intact.
    for (const [page, label] of [
      [p1, "p1"],
      [p2, "p2"],
      [p3, "p3"],
    ]) {
      const snap = await dailyDiagSnapshot(page);
      expect(snap, `${label}: callObject diag hook missing`).toBeTruthy();
      const positions = snap.participants
        .map((p) => p.userData?.position)
        // Position is set as a string by Empirica; coerce to number for
        // the set comparison (the contract is "values 0/1/2 in any order"
        // regardless of representation).
        .filter((v) => v !== undefined && v !== null)
        .map((v) => Number(v));
      expect(
        new Set(positions),
        `${label}: positions seen across participants — got ${JSON.stringify(snap.participants)}`,
      ).toEqual(new Set([0, 1, 2]));

      // Exactly one participant in the map has local=true (this peer).
      const localCount = snap.participants.filter((p) => p.local).length;
      expect(localCount, `${label}: exactly one local participant`).toBe(1);
    }
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
    await ctx1.close();
    await ctx2.close();
    await ctx3.close();
  }
});
