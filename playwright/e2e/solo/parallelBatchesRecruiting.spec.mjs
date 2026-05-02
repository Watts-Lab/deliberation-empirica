// Parallel batches recruiting-precedence L3 spec.
//
// Pins the platform contract that when multiple batches are open at
// the same time, only the OLDEST one recruits incoming participants.
// This is enforced by `setCurrentlyRecruitingBatch` in callbacks.js,
// which fires on every batch.status flip and points
// `recruitingBatchConfig` at the oldest open batch.
//
// What this catches that lower layers don't:
//   - L1 server-vitest covers the helpers (`getOpenBatches`,
//     `selectOldestBatch`) but those are fed synthetic batch lists.
//     They can't observe whether the chosen batch's config actually
//     reaches participants who connect after the dispatch.
//   - No existing e2e exercises 2 simultaneously-open batches at all.
//     A regression where the participant client ended up subscribed
//     to ANY open batch (or to the newest, or to a stale one) would
//     slip past every existing test.
//
// Specifically pins:
//   - Two distinct batches can be open at the same time
//   - A participant connecting while both are open is dispatched
//     into the OLDER batch (that batch's scienceData JSONL contains
//     their row, the newer batch's file does not)
//   - After the older batch is terminated, a fresh participant is
//     dispatched into the previously-younger batch (now the only
//     open one)
//   - Each batch's scienceData JSONL contains exactly one row
//     (the participant who landed in that batch)

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
    logPrefix: "solo-parallel",
  });
  admin = await connectAsAdmin({
    tajribaURL: `http://127.0.0.1:${stack.ports.empirica}/query`,
    srtoken: readSrtoken(),
  });
});

test.afterAll(async () => {
  if (stack) await stack.stop();
});

// Stand a single batch up to "running" and return its id. Helper so
// the test body reads as the recruiting-precedence story rather than
// the bookkeeping.
async function startSoloBatch(batchName) {
  const id = await createBatch(
    admin,
    batchConfig({ batchName, treatments: ["solo_1p"] }),
  );
  await waitForAttribute(admin, id, (attrs) => attrs.initialized === true, {
    timeoutMs: 30_000,
  });
  await startBatch(admin, id);
  await waitForAttribute(admin, id, (attrs) => attrs.status === "running", {
    timeoutMs: 5_000,
  });
  return id;
}

// Read either the scienceData or payment JSONL for a batch.
// scienceData rows omit `platformId` (it's only in payment.jsonl —
// see scienceDataHelpers.buildPlayerData), so per-participant
// attribution checks below read payment.jsonl.
function readBatchRows(batchName, suffix) {
  const files = readdirSync(stack.dataDir);
  const file = files.find(
    (f) => f.endsWith(suffix) && f.includes(batchName),
  );
  if (!file) {
    throw new Error(
      `expected a ${suffix} for batch ${batchName} in ${stack.dataDir}, got: ${files.join(", ")}`,
    );
  }
  const body = readFileSync(join(stack.dataDir, file), "utf8").trim();
  return body
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test("parallel batches: oldest open batch recruits; after it terminates, the next-oldest takes over", async ({
  browser,
}) => {
  const tag = Date.now();
  const batchAName = `parallel_a_${tag}`;
  const batchBName = `parallel_b_${tag}`;
  const p1Key = `parallel_p1_${tag}`;
  const p2Key = `parallel_p2_${tag}`;

  // ── Phase 1: open both batches, A first then B ───────────────────
  // batchA must be sequentially older — same `Date.now()` tag would
  // be ambiguous, so start A and let it reach `running` before
  // creating B. setCurrentlyRecruitingBatch fires on B's "running"
  // flip and re-evaluates "oldest open"; since A is still running
  // and was created first, A remains the recruiter.
  const batchAId = await startSoloBatch(batchAName);
  const batchBId = await startSoloBatch(batchBName);
  expect(batchAId).not.toBe(batchBId);

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const p1 = await ctx1.newPage();
  await installBrowserMocks(ctx1);
  await installBrowserMocks(ctx2);

  try {
    // ── Phase 2: participant 1 connects while both A and B are open ─
    // Should land in batch A (oldest).
    await walkToGame(p1, {
      url: stack.urls.player,
      playerKey: p1Key,
      gamePromptName: "soloPrompt",
    });

    // ── Phase 3: stop batch A. setCurrentlyRecruitingBatch fires on
    //   the "terminated" status flip, sees only B is open, and
    //   points recruiting at B.
    await stopBatch(admin, batchAId);
    await waitForAttribute(
      admin,
      batchAId,
      (attrs) => attrs.status === "terminated",
      { timeoutMs: 10_000 },
    );
    // Allow the recruiting-config flip to propagate to any subsequent
    // client connects. The waitForAttribute above guarantees the
    // server-side status flip; setCurrentlyRecruitingBatch runs in
    // the same tick. A small settle absorbs the global-scope
    // propagation.
    await p1.waitForTimeout(500);

    // ── Phase 4: participant 2 connects with only B open ───────────
    // Should land in batch B.
    const p2 = await ctx2.newPage();
    await walkToGame(p2, {
      url: stack.urls.player,
      playerKey: p2Key,
      gamePromptName: "soloPrompt",
    });

    // ── Phase 5: stop batch B and let the writes settle ────────────
    await stopBatch(admin, batchBId);
    await waitForAttribute(
      admin,
      batchBId,
      (attrs) => attrs.status === "terminated",
      { timeoutMs: 10_000 },
    );
    await p1.waitForTimeout(2000);

    // ── Assertions ─────────────────────────────────────────────────
    // Each batch should produce its own JSONL pair with exactly one
    // row. Use payment.jsonl for per-participant attribution because
    // it carries `platformId` (the playerKey) directly; scienceData
    // hides that under the participantData/deliberationId mapping.
    const batchAScience = readBatchRows(batchAName, ".scienceData.jsonl");
    const batchBScience = readBatchRows(batchBName, ".scienceData.jsonl");
    const batchAPayment = readBatchRows(batchAName, ".payment.jsonl");
    const batchBPayment = readBatchRows(batchBName, ".payment.jsonl");

    expect(batchAScience.length, "batch A should have exactly 1 science row (p1)").toBe(1);
    expect(batchBScience.length, "batch B should have exactly 1 science row (p2)").toBe(1);
    expect(batchAPayment.length).toBe(1);
    expect(batchBPayment.length).toBe(1);

    expect(
      batchAScience[0].batchId,
      "batch A's row's batchId field should echo batch A's tajriba scope id",
    ).toBe(batchAId);
    expect(batchBScience[0].batchId).toBe(batchBId);

    // The load-bearing assertion: each batch recruited the right
    // participant. A regression where the recruiting precedence
    // broke (e.g. p1 landed in batch B because the new batch
    // displaced the old one) would put p1's row in batch B's file
    // and fail this.
    const batchAPlatformIds = batchAPayment.map((r) => r.platformId);
    const batchBPlatformIds = batchBPayment.map((r) => r.platformId);
    expect(
      batchAPlatformIds,
      "batch A (older when p1 connected) must own p1's row",
    ).toEqual([p1Key]);
    expect(
      batchBPlatformIds,
      "batch B (only open batch when p2 connected) must own p2's row",
    ).toEqual([p2Key]);

    // Cross-check: neither participant's playerKey should appear in
    // the OTHER batch's file. The toEqual above implies this for the
    // single-row case, but make the cross-batch isolation explicit
    // so a future change adding more rows wouldn't accidentally pass.
    expect(batchAPlatformIds).not.toContain(p2Key);
    expect(batchBPlatformIds).not.toContain(p1Key);
  } finally {
    await stopBatch(admin, batchAId).catch(() => {});
    await stopBatch(admin, batchBId).catch(() => {});
    await ctx1.close();
    await ctx2.close();
  }
});
