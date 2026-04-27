// Solo participant e2e — focused on flows that involve a single
// participant (or zero) and don't need the multi-participant
// coordination that smoke/ exercises.
//
// Currently covers the "naked URL" case (no `?playerKey=` query param)
// retired from cypress/e2e/00_Naked_URL.js — the smoke spec navigates
// participants to URLs with `?playerKey=...` so it can't catch a
// regression in the keyless boot path. This file is also the natural
// home for future solo-only flows (e.g. session resumption from
// cypress 07, single-participant intro/exit smokes, etc.).
//
// Uses the API-driven admin pattern (createBatch / startBatch via
// Tajriba GraphQL) so test setup is fast and doesn't depend on
// admin-UI selectors.

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

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(__dirname, "./fixtures");

let stack;
let admin;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({}, testInfo) => {
  stack = await launchStack({
    workerIndex: testInfo.workerIndex,
    fixtureDir,
    logPrefix: "solo",
  });
  admin = await connectAsAdmin({
    tajribaURL: `http://127.0.0.1:${stack.ports.empirica}/query`,
    srtoken: readSrtoken(),
  });
});

test.afterAll(async () => {
  if (stack) await stack.stop();
});

const baseBatchConfig = (batchName) => ({
  batchName,
  cdn: "test",
  treatmentFile: "study.treatments.yaml",
  customIdInstructions: "none",
  platformConsent: "US",
  consentAddendum: "none",
  debrief: "none",
  checkAudio: false,
  checkVideo: false,
  introSequence: "none",
  treatments: ["solo_1p"],
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

test("naked URL: bare player URL with no `?playerKey=` renders the IdForm", async ({
  page,
}) => {
  // 1. Stand up a batch via API so a batchConfig is available to the
  //    participant runtime — without one the EmpiricaPlayer would
  //    short-circuit to NoGames regardless of URL shape.
  const batchName = `solo_naked_${Date.now()}`;
  const batchId = await createBatch(admin, baseBatchConfig(batchName));
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

  try {
    // 2. Visit the *bare* player URL — no `?playerKey=` query param.
    //    Cypress 00 covered this case; the smoke spec doesn't (it
    //    always navigates with a generated playerKey). EmpiricaPlayer
    //    must render the ID-collection form so a participant can
    //    enter their recruitment identifier.
    await page.goto(stack.urls.player, { waitUntil: "load" });

    // The IdForm headline (client/src/intro-exit/IdForm.jsx) appears
    // for the no-playerKey path. Same string cypress 00 asserted on.
    await expect(
      page.getByText("This is a group discussion study."),
    ).toBeVisible({ timeout: 30_000 });
  } finally {
    // Always stop the batch so afterAll's stack.stop() doesn't trip
    // over a still-running batch on subsequent test runs.
    await stopBatch(admin, batchId).catch(() => {});
  }
});

// Walk a single participant past ID form + consent so they're a
// registered Empirica player (the state where `closeBatch` will pick
// them up and flip exitStatus). Reused by the cancel test below.
async function registerParticipant(page, playerKey) {
  await page.goto(`${stack.urls.player}?playerKey=${playerKey}`, {
    waitUntil: "load",
  });

  const idInput = page.locator('input[data-testid="inputPaymentId"]');
  await idInput.waitFor({ state: "visible", timeout: 30_000 });
  await idInput.fill(playerKey);
  await page.locator('button[data-testid="joinButton"]').click();

  const consentBtn = page.locator('button[data-testid="consentButton"]');
  await consentBtn.waitFor({ state: "visible", timeout: 30_000 });
  await consentBtn.click();
}

test("batch cancel: in-flight participant ends up exitStatus='incomplete' and sees 'closed' on revisit", async ({
  page,
}) => {
  // Replaces both cypress 02 tests:
  //   - "from intro steps": cancel mid-flow → revisit shows closed message
  //   - "from game":        cancel mid-flow → scienceData has incomplete row
  //
  // Both reduce to the same server-side behavior — closeBatch flips
  // every unclosed-out player to exitStatus="incomplete" and runs the
  // export — so we exercise it once with a single participant past
  // consent (enough to be a registered Empirica player).
  const batchName = `solo_cancel_${Date.now()}`;
  const playerKey = `solo_cancel_p_${Date.now()}`;

  const batchId = await createBatch(admin, baseBatchConfig(batchName));

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

    await registerParticipant(page, playerKey);

    // Cancel the batch via API. Server fires the batch.status handler,
    // which runs closeBatch → sets exitStatus="incomplete" on every
    // unclosed-out player → runs the scienceData export.
    await stopBatch(admin, batchId);
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.status === "terminated",
      { timeoutMs: 10_000 },
    );
    // closeBatch + closeOutPlayer + JSONL writes are async after the
    // status flip; small settle window matches what smoke does.
    await page.waitForTimeout(2000);

    // 1. Revisit: NoGames "registered-but-incomplete" branch should
    //    render the "experiment is now closed" message. Same string
    //    cypress 02 asserted ("experiment is now closed").
    await page.reload({ waitUntil: "load" });
    await expect(page.getByText("The experiment is now closed.")).toBeVisible({
      timeout: 30_000,
    });

    // Negative assertion: cypress 02 test 1 explicitly checked the
    // consent screen wasn't *also* showing — guards against a
    // regression where NoGames + Consent both mount after a cancel.
    // `getByText` doesn't fail on co-rendering, so the positive
    // assertion above doesn't subsume this.
    await expect(page.getByText("About this study")).not.toBeVisible();

    // 2. scienceData JSONL: exactly one row (single participant), with
    //    exitStatus="incomplete". Strict count matches cypress 02's
    //    `objs.length === 1` — guards against duplicate-row regressions
    //    (closeBatch is guarded by `closedOut` so re-entry is supposed
    //    to be idempotent; pin that here).
    const files = readdirSync(stack.dataDir);
    const scienceFile = files.find(
      (f) => f.endsWith(".scienceData.jsonl") && f.includes(batchName),
    );
    expect(
      scienceFile,
      `expected a scienceData jsonl for batch ${batchName} in ${stack.dataDir}, got: ${files.join(", ")}`,
    ).toBeTruthy();

    const body = readFileSync(join(stack.dataDir, scienceFile), "utf8").trim();
    expect(body.length, "scienceData file is empty").toBeGreaterThan(0);
    const rows = body
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    expect(
      rows.length,
      "expected exactly one row for the single participant",
    ).toBe(1);
    expect(rows[0].exitStatus).toBe("incomplete");
  } finally {
    // Best-effort cleanup so afterAll's stack.stop() doesn't trip over
    // a still-running batch if anything above failed before stopBatch
    // was reached. No-op when the batch is already terminated.
    await stopBatch(admin, batchId).catch(() => {});
  }
});
