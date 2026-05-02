// finalPayoffs in postFlightReport L3 spec.
//
// Pins that `report.finalPayoffs` in `*.postFlightReport.jsonl` is
// populated and reflects the dispatcher's knockdown calculations
// after each treatment is used. Reuses the dispatch_split_a/b
// fixtures from #99 — same multi-treatment + knockdowns setup, but
// observes the OTHER side of the contract (postFlightReport.jsonl
// instead of scienceData.jsonl).
//
// What this catches that lower layers don't:
//   - L1 dispatcher unit tests (`makeDispatcher`) verify that
//     persistentPayoffs gets knocked down inside the closure, but
//     the orchestration that copies the post-dispatch payoffs back
//     to `batch.set("finalPayoffs", ...)` only exists in
//     callbacks.js (line ~560 in the dispatch tick).
//   - PR #96 (postFlightReport shape) pinned timings + participant
//     counts but explicitly skipped finalPayoffs (no e2e was
//     exercising knockdowns at the time).
//   - PR #99 (multi-treatment dispatch) pinned the scienceData
//     side: which treatments got assigned. This spec pins the
//     postFlightReport's view: the payoff-state that drove those
//     assignments.
//
// Specifically pins (with knockdowns matrix [[0.01, 1], [1, 0.01]]):
//   - finalPayoffs is an array of length 2 (one per treatment)
//   - both values are numbers (not the persistentPayoffs sentinel
//     or undefined)
//   - both values are LESS than the initial 1.0 — using either
//     treatment hits its own payoff with the matrix's diagonal
//     entry (0.01)

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
    logPrefix: "multi-finalpayoffs",
  });
  admin = await connectAsAdmin({
    tajribaURL: `http://127.0.0.1:${stack.ports.empirica}/query`,
    srtoken: readSrtoken(),
  });
});

test.afterAll(async () => {
  if (stack) await stack.stop();
});

test("finalPayoffs in postFlightReport: dispatcher's post-knockdown payoff state surfaces in the aggregated report", async ({
  browser,
}) => {
  const tag = Date.now();
  const batchName = `multi_finalpayoffs_${tag}`;
  const p1Key = `payoffs_p1_${tag}`;
  const p2Key = `payoffs_p2_${tag}`;

  // Same multi-treatment + knockdowns setup as #99: each treatment is
  // playerCount=1, and using a treatment crashes its payoff to 1%.
  // After 2 dispatches (one per treatment), both payoffs end up at
  // 0.01 (each was the diagonal entry once).
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

    await Promise.all([
      walkToLobby(p1, { url: stack.urls.player, playerKey: p1Key }),
      walkToLobby(p2, { url: stack.urls.player, playerKey: p2Key }),
    ]);

    // Wait for both players to land in some game stage so the
    // dispatcher has fired and finalPayoffs is set on the batch.
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

    await stopBatch(admin, batchId);
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.status === "terminated",
      { timeoutMs: 10_000 },
    );
    await p1.waitForTimeout(2000);

    const files = readdirSync(stack.dataDir);
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
      "finalPayoffs must round-trip from dispatch state into the report",
    ).toBeTruthy();
    expect(Array.isArray(report.finalPayoffs)).toBe(true);
    expect(
      report.finalPayoffs.length,
      "one entry per treatment (here: 2)",
    ).toBe(2);

    // With the [[0.01, 1], [1, 0.01]] knockdowns matrix and equal
    // initial payoffs of 1, after each treatment is used once each
    // payoff is multiplied by its own diagonal entry (0.01). So
    // finalPayoffs should land at exactly [0.01, 0.01]. Pin to
    // toBeCloseTo(0.01, 5) — close enough to absorb floating-point
    // noise from chained multiplications, but tight enough that
    // a regression to e.g. 0.5/0.5 (wrong matrix indexing) or
    // 0.0001/0.0001 (double-application) would fail.
    for (const v of report.finalPayoffs) {
      expect(typeof v).toBe("number");
      expect(
        v,
        "each treatment used once → payoff = 1 × 0.01 = 0.01",
      ).toBeCloseTo(0.01, 5);
    }
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
    await ctx1.close();
    await ctx2.close();
  }
});
