// Multi-treatment dispatch L3 spec.
//
// Pins that when a batch is configured with multiple treatments and a
// knockdowns matrix that penalizes repetition, the dispatcher places
// incoming players into DIFFERENT treatments — not all into the same
// one. End-to-end, that means:
//
//   - 2 players arrive, batch has 2 treatments (each playerCount=1)
//     and a knockdowns matrix [[0.01, 1], [1, 0.01]] (using A
//     crashes A's payoff to 1%, leaving B fully attractive)
//   - Dispatcher's first pick: A (or B — payoffs equal at start)
//   - After knockdown, second pick: the OTHER treatment
//   - Result: 2 distinct games, one per treatment, each with one
//     player; both treatments are represented in scienceData
//
// What this catches that lower layers don't:
//   - L1 dispatcher property tests (#86) verify the dispatcher's
//     invariants in isolation against a stub player set: every
//     assignment honors playerCount, no player is double-assigned,
//     etc. They don't observe end-to-end that the dispatcher's
//     output actually becomes real game scopes with the right
//     treatments — that wiring (`game.set("treatment", ...)`,
//     `player.set("position", ...)`, scienceData round-trip) only
//     exists in callbacks.js and only runs against tajriba.
//   - smoke + multi specs all use single-treatment batches; no e2e
//     exercises the multi-treatment dispatch path at all.
//   - A regression where the dispatcher is bypassed (e.g. all players
//     placed in the first treatment regardless of payoffs/knockdowns)
//     would slip past every existing test.
//
// Specifically pins:
//   - Two distinct games created (distinct gameIds)
//   - Both treatment names appear exactly once across the rows
//   - Each player ends up in their own game (distinct gameIds per row)
//   - The dispatcher honored the knockdowns — neither treatment
//     was used twice

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
    logPrefix: "multi-dispatch",
  });
  admin = await connectAsAdmin({
    tajribaURL: `http://127.0.0.1:${stack.ports.empirica}/query`,
    srtoken: readSrtoken(),
  });
});

test.afterAll(async () => {
  if (stack) await stack.stop();
});

test("multi-treatment dispatch: knockdowns matrix splits 2 players across 2 distinct treatments + 2 distinct games", async ({
  browser,
}) => {
  const batchName = `multi_dispatch_${Date.now()}`;
  const p1Key = `dispatch_p1_${Date.now()}`;
  const p2Key = `dispatch_p2_${Date.now()}`;

  // Knockdowns matrix that crashes a treatment's payoff to 1% once
  // it's been used: [[0.01, 1], [1, 0.01]]. Read by row = "after
  // using treatment i, multiply payoff[j] by matrix[i][j]". So
  // after picking A, A's payoff becomes 0.01 and B's stays at 1 —
  // the dispatcher's next pick is forced to B.
  const batchId = await createBatch(
    admin,
    batchConfig({
      batchName,
      treatments: ["dispatch_split_a", "dispatch_split_b"],
      knockdowns: [
        [0.01, 1],
        [1, 0.01],
      ],
    }),
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

    // Walk both participants in parallel — when they're both in the
    // lobby at the same dispatch tick, the dispatcher sees 2 players
    // and 2 treatments and applies the knockdowns matrix.
    await Promise.all([
      walkToLobby(p1, { url: stack.urls.player, playerKey: p1Key }),
      walkToLobby(p2, { url: stack.urls.player, playerKey: p2Key }),
    ]);

    // Wait for each player to land in SOME game stage. We don't know
    // which player got A vs B — that's a dispatcher implementation
    // detail (could be either order, depending on player insertion
    // order). Wait on the textarea (not just the prompt container) so
    // a regression that renders the container while the prompt body
    // fails to load doesn't slip through. The exact distribution is
    // pinned downstream from the scienceData rows.
    await Promise.all([
      Promise.race([
        p1
          .locator('[data-testid="element-prompt-probeA"] textarea')
          .waitFor({ state: "visible", timeout: 60_000 }),
        p1
          .locator('[data-testid="element-prompt-probeB"] textarea')
          .waitFor({ state: "visible", timeout: 60_000 }),
      ]),
      Promise.race([
        p2
          .locator('[data-testid="element-prompt-probeA"] textarea')
          .waitFor({ state: "visible", timeout: 60_000 }),
        p2
          .locator('[data-testid="element-prompt-probeB"] textarea')
          .waitFor({ state: "visible", timeout: 60_000 }),
      ]),
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

    // ── Treatment distribution ─────────────────────────────────────
    // The load-bearing assertion: BOTH treatment names should appear
    // exactly once across the two rows. If the dispatcher ignored the
    // knockdowns and placed both players in the same treatment, this
    // would fail — one treatment name would appear twice and the
    // other zero times.
    const treatmentNames = rows.map((r) => r.treatment?.name).sort();
    expect(
      treatmentNames,
      `both treatments should be used exactly once; got ${JSON.stringify(treatmentNames)}`,
    ).toEqual(["dispatch_split_a", "dispatch_split_b"]);

    // ── Game distribution ──────────────────────────────────────────
    // With playerCount=1, each game holds exactly one player. So the
    // 2 rows must reference 2 distinct gameIds. A regression where
    // both players collapsed into one game (or where one treatment's
    // game wasn't created at all) would produce 1 unique gameId
    // instead of 2.
    const gameIds = new Set(rows.map((r) => r.gameId));
    expect(
      gameIds.size,
      `expected 2 distinct gameIds (one per dispatched treatment), got ${gameIds.size}`,
    ).toBe(2);

    // ── Per-row treatment metadata round-trip ─────────────────────
    // Each row's treatment.gameStages should reflect the assigned
    // treatment's configuration, not the other one. Pin via the
    // distinct stage names.
    const rowsByTreatment = Object.fromEntries(
      rows.map((r) => [r.treatment.name, r]),
    );
    expect(rowsByTreatment.dispatch_split_a.treatment.gameStages[0].name).toBe(
      "A side stage",
    );
    expect(rowsByTreatment.dispatch_split_b.treatment.gameStages[0].name).toBe(
      "B side stage",
    );

    // ── Position invariant ─────────────────────────────────────────
    // Each treatment is playerCount=1, so the only valid position is
    // "0". A regression where the dispatcher writes a position
    // outside the treatment's slot range would fail this.
    expect(rowsByTreatment.dispatch_split_a.position).toBe("0");
    expect(rowsByTreatment.dispatch_split_b.position).toBe("0");
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
    await ctx1.close();
    await ctx2.close();
  }
});
