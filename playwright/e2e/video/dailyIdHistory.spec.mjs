// Daily session-ID tracking L3 spec.
//
// Pins the integration contract that `useDailyIdTracking` (subscribed
// to Daily's `joined-meeting` event) populates `player.dailyIdHistory`
// with at least one entry per video-stage join, and that the entry
// makes it into the scienceData JSONL export with the expected shape.
//
// This is the data the science team uses to associate per-stage
// recordings with participant sessions. Issue #1226 documented a
// regression where the history was getting *duplicate* entries on
// stage transitions; the L1 fix is `useDailyIdTracking.js`'s
// last-entry dedup. This L3 confirms the cumulative shape lands
// in the export — not the dedup itself, which is L2.

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
    logPrefix: "video-dailyids",
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

test("dailyIdHistory: 1-player video stage produces a dailyIdHistory entry that lands in scienceData", async ({
  page,
}) => {
  const batchName = `video_dailyids_${Date.now()}`;
  const playerKey = `video_dailyids_p_${Date.now()}`;

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

    // Settle window for `joined-meeting` → `useDailyIdTracking` →
    // `player.append("dailyIdHistory", ...)` to land before stopBatch
    // triggers the export.
    await page.waitForTimeout(2_000);

    await stopBatch(admin, batchId);
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.status === "terminated",
      { timeoutMs: 15_000 },
    );
    await page.waitForTimeout(2_000);

    const files = readdirSync(stack.dataDir);
    const scienceFile = files.find(
      (f) => f.endsWith(".scienceData.jsonl") && f.includes(batchName),
    );
    expect(
      scienceFile,
      `expected scienceData jsonl in ${stack.dataDir} (got: ${files.join(", ")})`,
    ).toBeTruthy();

    const body = readFileSync(join(stack.dataDir, scienceFile), "utf8").trim();
    const rows = body
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    expect(rows.length).toBe(1);

    const history = rows[0].dailyIdHistory;
    expect(
      Array.isArray(history) && history.length >= 1,
      `dailyIdHistory should have at least one entry — got ${JSON.stringify(history)}`,
    ).toBe(true);

    // Each entry's shape per useDailyIdTracking.js: {dailyId,
    // progressLabel, stageElapsed, timestamp}. Pin the keys so a
    // future schema change shows up here.
    const entry = history[0];
    expect(typeof entry.dailyId).toBe("string");
    expect(entry.dailyId.length).toBeGreaterThan(0);
    expect(typeof entry.progressLabel).toBe("string");
    expect(typeof entry.timestamp).toBe("string");
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
  }
});
