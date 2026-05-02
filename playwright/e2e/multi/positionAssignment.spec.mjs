// Multi-player position assignment + treatment metadata round-trip L3
// spec. Pins two contracts that aren't covered elsewhere:
//
//   1. Two participants assigned to the same 2-player game land at
//      DISTINCT positions (one at "0", one at "1") in the scienceData
//      export. The dispatcher property tests assert this in isolation
//      against a hand-rolled fixture; this spec confirms the value
//      reaches the JSONL via the real client→server→export path.
//
//   2. The treatment metadata that researchers need to interpret data
//      (treatment.name, treatment.playerCount, treatment.gameStages)
//      round-trips into each row. The smoke spec pins `treatment.name`
//      but not the structural fields.
//
// What this catches that lower layers don't:
//   - Dispatcher property tests run against a stub player set; they
//     don't observe the wiring from `dispatch()` → `player.set("position",
//     N)` → JSONL export. A regression that, for example, persists the
//     position only on round/game scope (not player) would leave both
//     rows with `position === "missing"` and slip past dispatcher unit
//     coverage.
//   - The smoke spec checks per-row prompt values are distinct but
//     doesn't pin position assignment, so a regression where both
//     players get the same position (or no position) would not be
//     caught.

import { test, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, resolve, join } from "path";
import { readdirSync, readFileSync } from "fs";

import { launchStack } from "../_helpers/empiricaServer.mjs";
import {
  connectAsAdmin,
  readSrtoken,
  createBatch,
  startBatch,
  stopBatch,
  waitForAttribute,
} from "../_helpers/empiricaAdminAPI.mjs";
import { batchConfig } from "../_helpers/batchConfig.mjs";
import { walkToGame } from "../_helpers/walkParticipant.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(__dirname, "./fixtures");

let stack;
let admin;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({}, testInfo) => {
  stack = await launchStack({
    workerIndex: testInfo.workerIndex,
    fixtureDir,
    logPrefix: "multi-position",
  });
  admin = await connectAsAdmin({
    tajribaURL: `http://127.0.0.1:${stack.ports.empirica}/query`,
    srtoken: readSrtoken(),
  });
});

test.afterAll(async () => {
  if (stack) await stack.stop();
});

test("position assignment + treatment metadata: 2-player batch produces rows at positions '0' and '1' with full treatment.gameStages", async ({
  browser,
}) => {
  const batchName = `multi_position_${Date.now()}`;
  const p1Key = `multi_pos_p1_${Date.now()}`;
  const p2Key = `multi_pos_p2_${Date.now()}`;

  const batchId = await createBatch(
    admin,
    batchConfig({ batchName, treatments: ["multi_2p_shared"] }),
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

    // Both players walk through intro in parallel. The dispatcher
    // groups them into the same multi_2p_shared game (playerCount=2)
    // since both are ready when dispatchWait elapses.
    // multi_2p_shared has a `sharedColor` prompt — wait for it as the
    // per-player signal that intro is cleared AND dispatch placed the
    // player at a position.
    await Promise.all([
      walkToGame(p1, {
        url: stack.urls.player,
        playerKey: p1Key,
        gamePromptName: "sharedColor",
      }),
      walkToGame(p2, {
        url: stack.urls.player,
        playerKey: p2Key,
        gamePromptName: "sharedColor",
      }),
    ]);

    // Stop the batch — closeBatch fires closeOutPlayer for both
    // players, writing one scienceData JSONL row each.
    await stopBatch(admin, batchId);
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.status === "terminated",
      { timeoutMs: 10_000 },
    );
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
    expect(rows.length, "expected one row per player").toBe(2);

    // -------- Position assignment --------
    // Both rows must have a position field (no "missing" sentinel).
    const positions = rows.map((r) => r.position).sort();
    expect(
      positions,
      `positions must be the literal strings "0" and "1" (one each) — got ${JSON.stringify(positions)}`,
    ).toEqual(["0", "1"]);

    // Pin that no two rows share a position. The .toEqual above
    // already implies this, but make it explicit so a future
    // regression (e.g. dispatcher assigning position 0 to both)
    // produces an error message that names the bug.
    const uniquePositions = new Set(positions);
    expect(
      uniquePositions.size,
      "each player must have a distinct position",
    ).toBe(2);

    // Pin that the two rows correspond to two distinct participants
    // (not e.g. two duplicate writes for the same player). `sampleId`
    // is the platform-stable per-participant identifier; if the
    // export accidentally collapsed both rows to the same player,
    // this set's size would be 1.
    const sampleIds = new Set(rows.map((r) => r.sampleId).filter(Boolean));
    expect(
      sampleIds.size,
      `expected two distinct sampleIds across rows, got: ${JSON.stringify(rows.map((r) => r.sampleId))}`,
    ).toBe(2);

    // -------- Treatment metadata round-trip --------
    // Both rows must carry the same treatment object (it's a property
    // of the game, not the player). Pin name + playerCount + the
    // gameStages array shape so researchers can interpret data
    // without needing the original YAML.
    for (const row of rows) {
      expect(row.treatment).toBeTruthy();
      expect(row.treatment.name).toBe("multi_2p_shared");
      expect(row.treatment.playerCount).toBe(2);
      expect(
        Array.isArray(row.treatment.gameStages),
        "treatment.gameStages must round-trip into the export",
      ).toBe(true);
      expect(row.treatment.gameStages.length).toBe(1);

      // Pin one stage-shape detail so a regression that drops elements
      // (e.g. only persists the first stage's name) is caught.
      const stage = row.treatment.gameStages[0];
      expect(stage.name).toBe("Shared and individual choices");
      expect(Array.isArray(stage.elements)).toBe(true);
      expect(stage.elements.length).toBeGreaterThanOrEqual(2);

      // Every row references the same gameId (both players in the
      // same game). Pin this so a regression where dispatch silently
      // splits 2-player treatments into 1-player games is caught.
      expect(row.gameId).toBeTruthy();
    }
    const gameIds = new Set(rows.map((r) => r.gameId));
    expect(
      gameIds.size,
      "both rows must reference the same gameId — dispatcher should group them",
    ).toBe(1);
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
    await ctx1.close();
    await ctx2.close();
  }
});
