// Dropout L3 spec — replaces cypress 11 (Dropouts) "manages dropouts" test.
//
// Three participants join a chatType=video stage against real Daily.
// One opens the ReportMissing modal and selects "I am the only one in
// the video call." (key: "onlyOne"). The other two click "I'm here!"
// in their "Are you there?" modal. The test verifies via the scienceData
// export that:
//   - p1's `reports` captured the "onlyOne" code with the right shape
//   - p2 + p3's `checkIns` each captured an entry for the active stage
//
// What this catches that lower layers don't:
//   - Multi-player real-time check-in propagation (game.checkInRequests
//     fan-out + player.checkIns aggregation across browsers — single-
//     browser L2 can't see this)
//   - ReportMissingProvider mounted via Discussion.jsx only when
//     chatType==="video" (the cypress 11 contract)
//   - End-to-end Daily session bringup × 3 in one stage, real WebRTC
//
// Coverage for the *failure* path (no check-ins → 60s timeout →
// discussionFailed=true auto-advance) is intentionally omitted from
// this spec to keep the participant-minute cost down on the gated
// workflow. Worth a follow-up if we want the full matrix.
//
// Cost: 3 participants × ~1-2 min of real-WebRTC time = 3-6
// participant-minutes per run. Daily free tier is 10,000/month.

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
    logPrefix: "video-dropout",
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

test("dropout: ReportMissing onlyOne + 2 check-ins propagates across 3 players, scienceData captures reports + checkIns", async ({
  browser,
}) => {
  const batchName = `video_dropout_${Date.now()}`;
  const p1Key = `video_dropout_p1_${Date.now()}`;
  const p2Key = `video_dropout_p2_${Date.now()}`;
  const p3Key = `video_dropout_p3_${Date.now()}`;

  const batchId = await createBatch(admin, {
    batchName,
    cdn: "test",
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
    centralPrereg: false,
    preregRepos: [],
    dataRepos: [],
    videoStorage: "none",
    exitCodes: "none",
  });

  // Three independent browser contexts → three independent participant
  // sessions (one localStorage / one playerKey each). Same pattern as
  // multi/test.spec.mjs.
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

    // Walk all three through intro in parallel — they need to arrive
    // close enough together that the dispatcher matches them into one
    // game (dispatchWait: 1).
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

    // All three reach the video stage. Wait for each call to mount.
    await Promise.all([
      waitForCallMounted(p1),
      waitForCallMounted(p2),
      waitForCallMounted(p3),
    ]);

    // ── p1 reports missing with "onlyOne" ────────────────────────────────
    // The reportMissing button lives in the Tray (testid="reportMissing").
    await p1.locator('[data-testid="reportMissing"]').click();

    // The RadioGroup for missingDetails has testid="missingDetails".
    // Pick the "onlyOne" key — match by label text (the user-facing copy
    // in ReportMissing.jsx), same approach we use for PreIdChecks.
    await p1
      .getByLabel("I am the only one in the video call.")
      .check();
    await p1.locator('[data-testid="submitReportMissing"]').click();

    // ── p2 + p3 see "Are you there?" → click "I'm here!" ─────────────────
    // The check-in button has testid="checkIn". The modal renders only
    // after game.checkInRequests has propagated and the gracePeriod
    // window opens — give it time before asserting visible.
    await Promise.all([
      p2
        .locator('[data-testid="checkIn"]')
        .waitFor({ state: "visible", timeout: 30_000 }),
      p3
        .locator('[data-testid="checkIn"]')
        .waitFor({ state: "visible", timeout: 30_000 }),
    ]);
    await Promise.all([
      p2.locator('[data-testid="checkIn"]').click(),
      p3.locator('[data-testid="checkIn"]').click(),
    ]);

    // Small settle window for the player.append("checkIns", ...)
    // writes to propagate before we end the batch and trigger the
    // scienceData export.
    await p1.waitForTimeout(2000);

    // ── End the batch + verify scienceData ───────────────────────────────
    await stopBatch(admin, batchId);
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.status === "terminated",
      { timeoutMs: 15_000 },
    );
    // closeBatch + closeOutPlayer + JSONL writes are async after the
    // status flip; same settle window other specs use.
    await p1.waitForTimeout(2000);

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

    // One row per participant. scienceDataHelpers' buildPlayerData
    // doesn't include `playerKey` in the row — identify the reporter
    // by the exported reports payload (the only player who'd have a
    // "onlyOne" code) and the non-reporters by exclusion.
    expect(rows.length).toBe(3);

    const reporterRows = rows.filter(
      (row) =>
        Array.isArray(row.reports) &&
        row.reports.some((report) => report?.code === "onlyOne"),
    );
    expect(
      reporterRows.length,
      `expected exactly one row with reports[].code === "onlyOne" — got ${JSON.stringify(rows.map((r) => r.reports))}`,
    ).toBe(1);
    const reporterRow = reporterRows[0];

    // The other two rows should each have a propagated check-in.
    // ReportMissing.jsx appends `{stage, timestamp}` to player.checkIns
    // on click — existence of *any* entry is sufficient signal that
    // the cross-participant propagation worked.
    const checkInRows = rows.filter((row) => row !== reporterRow);
    expect(
      checkInRows.length,
      `expected exactly two non-reporter rows — got ${rows.length}`,
    ).toBe(2);
    for (const row of checkInRows) {
      expect(
        Array.isArray(row.checkIns) && row.checkIns.length >= 1,
        `non-reporter checkIns should have at least one entry — got ${JSON.stringify(row.checkIns)}`,
      ).toBe(true);
    }
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
    await ctx1.close();
    await ctx2.close();
    await ctx3.close();
  }
});
