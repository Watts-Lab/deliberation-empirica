// Explicit per-treatment payoffs L3 spec — concentration variant.
//
// Pins that when payoffs are an explicit array (not the "equal"
// sentinel) and knockdowns are "none", the dispatcher concentrates
// players on the higher-payoff treatment instead of distributing
// them. Complements #99 (which pins the OPPOSITE: knockdowns force
// distribution across treatments) and #101 (which pins finalPayoffs
// reflecting knockdowns).
//
// Setup:
//   - 2 treatments (dispatch_split_a / dispatch_split_b), each
//     playerCount=1
//   - payoffs: [10, 1] — A is 10x more attractive than B
//   - knockdowns: "none" — payoffs don't decay after use
//   - 2 incoming players → dispatcher picks A both times because
//     A's payoff stays at 10 throughout
//
// What this catches that lower layers don't:
//   - L1 dispatcher unit tests verify the greedy-pick logic with
//     synthetic payoffs/knockdowns inputs, but don't exercise the
//     batch-config validation path that translates the YAML/JSON
//     `payoffs: [10, 1]` into `persistentPayoffs` inside the
//     dispatcher closure.
//   - PR #99 + #101 cover the multi-treatment dispatch with
//     knockdowns matrix, where the platform forces variety.
//     The "no knockdowns + asymmetric payoffs" branch — the
//     simplest case for studies that just want to A/B test against
//     a low-payoff baseline — isn't pinned anywhere.
//
// Specifically pins:
//   - Both rows in scienceData reference treatment.name === A
//   - Treatment B was used 0 times (no scienceData rows for it)
//   - 2 distinct gameIds (since playerCount=1 → 2 separate games)
//   - finalPayoffs in postFlightReport stays at [10, 1] —
//     knockdowns="none" → no decay

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
    logPrefix: "multi-payoffs",
  });
  admin = await connectAsAdmin({
    tajribaURL: `http://127.0.0.1:${stack.ports.empirica}/query`,
    srtoken: readSrtoken(),
  });
});

test.afterAll(async () => {
  if (stack) await stack.stop();
});

test("explicit payoffs + no knockdowns: dispatcher concentrates players on the higher-payoff treatment", async ({
  browser,
}) => {
  const tag = Date.now();
  const batchName = `multi_payoffs_${tag}`;
  const p1Key = `payoffs_p1_${tag}`;
  const p2Key = `payoffs_p2_${tag}`;

  const batchId = await createBatch(
    admin,
    batchConfig({
      batchName,
      treatments: ["dispatch_split_a", "dispatch_split_b"],
      payoffs: [10, 1],
      knockdowns: "none",
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

    await Promise.all([
      walkToLobby(p1, { url: stack.urls.player, playerKey: p1Key }),
      walkToLobby(p2, { url: stack.urls.player, playerKey: p2Key }),
    ]);

    // Both players should land on treatment A (probeA), since the
    // dispatcher with no knockdowns will keep picking A. Wait on A's
    // textarea; B's probe should never appear for either player.
    await Promise.all([
      p1
        .locator('[data-testid="element-prompt-probeA"] textarea')
        .waitFor({ state: "visible", timeout: 60_000 }),
      p2
        .locator('[data-testid="element-prompt-probeA"] textarea')
        .waitFor({ state: "visible", timeout: 60_000 }),
    ]);

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
    const rows = readFileSync(join(stack.dataDir, scienceFile), "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    expect(rows.length, "one row per participant").toBe(2);

    // ── finalPayoffs is the deterministic pin ──────────────────────
    // Asserted FIRST because it's the rock-solid detector for "did
    // the explicit [10, 1] payoffs actually reach the dispatcher?"
    // — equality of arrays. The concentration assertion below is
    // CORROBORATING evidence; on its own it's probabilistic
    // (dispatch.js random tiebreak on equal payoffs could pick A
    // twice ~25% of the time even if [10, 1] were silently
    // replaced by the equal-sentinel). Pinning finalPayoffs first
    // is what catches the regression deterministically.
    const reportFile = files.find(
      (f) => f.endsWith(".postFlightReport.jsonl") && f.includes(batchName),
    );
    expect(
      reportFile,
      `expected a postFlightReport jsonl for batch ${batchName} in ${stack.dataDir}, got: ${files.join(", ")}`,
    ).toBeTruthy();
    const report = JSON.parse(
      readFileSync(join(stack.dataDir, reportFile), "utf8").trim(),
    );
    expect(
      report.finalPayoffs,
      `finalPayoffs should be exactly [10, 1] — knockdowns="none" means no decay; got ${JSON.stringify(report.finalPayoffs)}`,
    ).toEqual([10, 1]);

    // ── Concentration: corroborating evidence ──────────────────────
    // Given finalPayoffs is [10, 1] (asserted above), payoffs[0] is
    // strictly greater than payoffs[1] for every dispatch tick →
    // dispatcher's greedy pick lands on A both times. A failure
    // here while finalPayoffs passed would indicate a regression in
    // the greedy selection itself, not in payoff handling.
    const treatmentNames = rows.map((r) => r.treatment?.name).sort();
    expect(
      treatmentNames,
      `both players should land in dispatch_split_a; got ${JSON.stringify(treatmentNames)}`,
    ).toEqual(["dispatch_split_a", "dispatch_split_a"]);

    // ── Each player in their own game ─────────────────────────────
    // playerCount=1 means the dispatcher creates a fresh game per
    // player; both gameIds should be distinct.
    const gameIds = new Set(rows.map((r) => r.gameId));
    expect(
      gameIds.size,
      "playerCount=1 → 2 separate games (both of treatment A)",
    ).toBe(2);
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
    await ctx1.close();
    await ctx2.close();
  }
});
