// Pre-registration JSONL export shape L3 spec.
//
// Pins the per-row contract of `*.preregistration.jsonl`, which is
// what reviewers compare against the actual experimental data to
// confirm "what was pre-registered matches what actually ran". The
// shape is intentionally narrower than scienceData: a frozen snapshot
// of the participant's intended treatment + the batch context at
// game start, taken BEFORE any participant data is collected.
//
// What this catches that lower layers don't:
//   - L1 server-vitest preregisterHelpers tests are fully synthetic —
//     they call buildPreregData with hand-rolled fixtures. They can't
//     observe whether `preregisterSample` actually fires per-player at
//     game start (callbacks.js:357 inside the `Empirica.on("game")`
//     handler), or whether the resulting JSONL line lands on disk in
//     the file the batch declared in `preregistrationDataFilename`.
//   - No existing e2e reads the preregistration file. Smoke / solo
//     cancel / api-driven look at scienceData and payment.jsonl only.
//   - A regression that broke `randomUUID()` minting (e.g. dependency
//     upgrade returning empty), or that swallowed the appendJsonlLine
//     call, would slip through every existing test silently.
//
// Specifically pins:
//   - One pre-registration row per participant
//   - sampleId is a real UUID (matches the canonical v4 regex)
//   - sampleId on the row matches the player.set("sampleId", …) used
//     downstream in scienceData (cross-reference identity).
//   - batchId echoes the tajriba scope id; gameId is set
//   - timeBatchInitialized is a real ISO timestamp
//   - timeGameStarted is *undefined* — load-bearing ordering invariant:
//     preregisterSample fires INSIDE the game-start handler, before
//     `game.set("timeGameStarted", ...)` runs, so the prereg snapshot
//     legitimately captures pre-game state. A regression that reordered
//     these calls would populate this field and break the "snapshot
//     before data is collected" guarantee.
//   - treatmentMetadata: name + playerCount + treatmentHash (40-hex
//     SHA-1)
//   - assetsRepoSha is a 40-hex (mock returns deterministic SHA)
//   - position is "0" (solo dispatcher invariant)
//   - exportErrors is empty on the happy path

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

const ISO_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let stack;
let admin;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({}, testInfo) => {
  stack = await launchStack({
    workerIndex: testInfo.workerIndex,
    fixtureDir,
    logPrefix: "solo-prereg",
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
});

test("preregistration.jsonl shape: solo run produces one row with UUID sampleId, treatmentHash, and timing milestones", async ({
  page,
}) => {
  const batchName = `solo_prereg_${Date.now()}`;
  const playerKey = `solo_prereg_p_${Date.now()}`;

  const batchId = await createBatch(
    admin,
    batchConfig({ batchName, treatments: ["solo_1p"] }),
  );

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

    // Walk through intro into the game stage. preregisterSample fires
    // inside the server's `Empirica.on("game")` handler the moment a
    // game is created (after dispatch), which happens once the player
    // clears intro and the game stage mounts. We don't need to submit
    // anything — pre-registration is, by design, a snapshot taken
    // BEFORE participant action.
    await walkToGame(page, {
      url: stack.urls.player,
      playerKey,
      gamePromptName: "soloPrompt",
    });

    // Stop the batch — by now the prereg row has already been written
    // (it fires at game start, well before this point). Stopping is
    // just to ensure the file write is flushed before we read it.
    await stopBatch(admin, batchId);
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.status === "terminated",
      { timeoutMs: 10_000 },
    );
    await page.waitForTimeout(2000);

    const files = readdirSync(stack.dataDir);
    const preregFile = files.find(
      (f) => f.endsWith(".preregistration.jsonl") && f.includes(batchName),
    );
    expect(
      preregFile,
      `expected a preregistration jsonl for batch ${batchName} in ${stack.dataDir}, got: ${files.join(", ")}`,
    ).toBeTruthy();

    const body = readFileSync(join(stack.dataDir, preregFile), "utf8").trim();
    expect(body.length, "preregistration file is empty").toBeGreaterThan(0);
    const rows = body
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    expect(rows.length, "expected exactly one prereg row for solo").toBe(1);
    const row = rows[0];

    // sampleId: must be a real v4 UUID (pin both that it's set AND
    // that it's the right format — empty-string would pass a typeof
    // check but fail the regex).
    expect(row.sampleId).toMatch(UUID_V4_RE);

    // Cross-reference identity: the sampleId on this prereg row must
    // also match the sampleId attribute the server set on the player
    // (consumed by scienceData export). If the two diverged, downstream
    // tooling that joins prereg ↔ scienceData on sampleId would break.
    // We confirm by also reading scienceData and comparing.
    const scienceFile = files.find(
      (f) => f.endsWith(".scienceData.jsonl") && f.includes(batchName),
    );
    expect(
      scienceFile,
      "scienceData file should exist alongside prereg",
    ).toBeTruthy();
    const scienceBody = readFileSync(
      join(stack.dataDir, scienceFile),
      "utf8",
    ).trim();
    const scienceRow = JSON.parse(scienceBody.split("\n")[0]);
    expect(
      scienceRow.sampleId,
      "scienceData and prereg must agree on sampleId — joins downstream rely on it",
    ).toBe(row.sampleId);

    // Static identifiers
    expect(row.batchId).toBe(batchId);
    expect(row.gameId).toBeTruthy();
    // Solo dispatcher invariant
    expect(row.position).toBe("0");

    // Timing — only timeBatchInitialized is reliably present at the
    // moment preregisterSample fires (which is inside the game-start
    // handler, BEFORE the handler finishes setting timeGameStarted on
    // the game scope). timeGameStarted being absent on the prereg row
    // is in fact a load-bearing contract: it confirms the snapshot
    // was taken at the EARLIEST possible point in the game lifecycle,
    // which is what reviewers rely on for "this is what the experiment
    // was, before any data was collected".
    expect(row.timeBatchInitialized).toMatch(ISO_RE);
    expect(
      row.timeGameStarted,
      "timeGameStarted should be undefined on the prereg row — preregister fires before the game-start handler sets it (a regression that reorders these would clobber the 'snapshot before data' invariant)",
    ).toBeUndefined();

    // Treatment metadata + hash
    expect(row.treatmentMetadata).toBeTruthy();
    expect(row.treatmentMetadata.name).toBe("solo_1p");
    expect(row.treatmentMetadata.playerCount).toBe(1);
    expect(
      row.treatmentMetadata.treatmentHash,
      "treatmentHash must be a 40-char hex SHA-1 of the canonicalized treatment",
    ).toMatch(/^[0-9a-f]{40}$/);

    // assetsRepoSha — same mock-driven 40-hex sha smoke pins
    expect(row.assetsRepoSha).toMatch(/^[0-9a-f]{40}$/);

    // Happy-path: no export errors should be collected
    expect(row.exportErrors).toEqual([]);
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
  }
});
