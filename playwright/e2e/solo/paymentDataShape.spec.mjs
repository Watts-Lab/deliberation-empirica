// Payment-data export shape L3 spec.
//
// Pins the per-row contract of `*.payment.jsonl`, which is what
// researchers use to compensate participants. The contract is
// intentionally narrower than scienceData — it includes connectionInfo
// and exit metadata but explicitly does NOT include prompts, surveys,
// treatment, or anything else that's part of the science export. A
// regression that bleeds science fields into payment.jsonl (or vice
// versa) is the concrete failure mode this spec guards against.
//
// What this catches that lower layers don't:
//   - L1 server-vitest paymentDataHelpers.test.js pins the row builder
//     against synthetic player/batch fixtures. It can't observe:
//       a) That the client-side `entryUrl` collection in Consent.jsx
//          actually feeds URL query params into player state.
//       b) That those params then spread into the payment row at
//          export time (the `...(player?.get("entryUrl")?.params || {})`
//          line in buildPaymentData).
//       c) The end-to-end orchestration: closeBatch fires
//          exportPaymentData on terminate, which appends a JSONL line.
//   - The smoke + solo cancel specs read scienceData but not payment.
//     A regression that broke just the payment writer (without
//     affecting science) would slip past every existing test.
//
// Specifically pins:
//   - One row per participant in `*.payment.jsonl`
//   - Static fields: batchId, batchName, platformId, introDone,
//     timeIntroDone, exitStatus, connectionInfo, exportErrors
//   - URL-param spread: arbitrary `?foo=bar` URL params surface as
//     top-level row fields. Researchers rely on this for
//     workerId / assignmentId / source attribution from MTurk-style
//     entry URLs.
//   - Negative side: prompts/surveys/treatment fields are NOT in the
//     payment row (those belong to scienceData). Pin the boundary.

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

let stack;
let admin;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({}, testInfo) => {
  stack = await launchStack({
    workerIndex: testInfo.workerIndex,
    fixtureDir,
    logPrefix: "solo-payment",
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

test("payment.jsonl shape: solo run with custom URL params produces one row with the expected fields and URL-param spread", async ({
  page,
}) => {
  const batchName = `solo_payment_${Date.now()}`;
  const playerKey = `solo_pay_p_${Date.now()}`;
  // Custom URL params — researchers commonly attach these (workerId,
  // assignmentId, source) when recruiting from MTurk / Prolific. The
  // platform contract is that these spread into the payment row.
  const workerId = `worker_${Date.now()}`;
  const assignmentId = `asgn_${Date.now()}`;
  const source = "test_recruiter";

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

    // Visit with the extra URL params. Consent.jsx reads them from
    // window.location and stores them under `entryUrl.params`. The
    // helper passes them through URLSearchParams so encoding is
    // handled correctly.
    await walkToGame(page, {
      url: stack.urls.player,
      playerKey,
      gamePromptName: "soloPrompt",
      extraParams: { workerId, assignmentId, source },
    });

    // Stop the batch — closeBatch → closeOutPlayer → exportPaymentData
    // writes the row.
    await stopBatch(admin, batchId);
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.status === "terminated",
      { timeoutMs: 10_000 },
    );
    await page.waitForTimeout(2000);

    const files = readdirSync(stack.dataDir);
    const paymentFile = files.find(
      (f) => f.endsWith(".payment.jsonl") && f.includes(batchName),
    );
    expect(
      paymentFile,
      `expected a payment jsonl for batch ${batchName} in ${stack.dataDir}, got: ${files.join(", ")}`,
    ).toBeTruthy();

    const body = readFileSync(join(stack.dataDir, paymentFile), "utf8").trim();
    expect(body.length, "payment file is empty").toBeGreaterThan(0);
    const rows = body
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    expect(rows.length, "expected exactly one payment row for solo").toBe(1);
    const row = rows[0];

    // -------- Static fields --------
    expect(row.batchId, "batchId must echo the tajriba scope id").toBe(batchId);
    expect(row.batchName).toBe(batchName);
    expect(row.platformId, "platformId is the playerKey on this fixture").toBe(
      playerKey,
    );
    expect(row.introDone, "intro was completed past nickname").toBe(true);
    expect(row.timeIntroDone).toMatch(ISO_RE);
    expect(row.exitStatus).toBe("incomplete");
    expect(row.exportErrors, "no export errors expected on the happy path").toEqual(
      [],
    );

    // connectionInfo round-trip — same mocked source as smoke spec.
    // Pin a couple of fields so a regression that drops the object
    // (or replaces it with a sentinel) is caught.
    expect(row.connectionInfo).toBeTruthy();
    expect(row.connectionInfo.country).toBe("US");
    expect(row.connectionInfo.isKnownVpn).toBe(false);

    // -------- URL-param spread --------
    // Each URL query param should appear as a top-level row field
    // verbatim — this is how researchers recover MTurk/Prolific
    // attribution from the payment file. Pinning these explicitly
    // is the canary for any regression that, e.g., scopes them
    // under a `params` sub-object instead of spreading.
    expect(row.workerId, "URL param workerId should spread to row").toBe(workerId);
    expect(row.assignmentId).toBe(assignmentId);
    expect(row.source).toBe(source);
    // playerKey is the special param — it's both a URL key and the
    // platformId, but the spread should still surface it.
    expect(row.playerKey).toBe(playerKey);

    // -------- Negative boundary --------
    // The payment row is intentionally narrower than scienceData.
    // Researchers should be able to share a payment file with a
    // payment vendor without leaking prompt content or treatment
    // metadata. Pin the boundary so a regression that bleeds science
    // fields in is caught loudly.
    expect(row).not.toHaveProperty("prompts");
    expect(row).not.toHaveProperty("surveys");
    expect(row).not.toHaveProperty("treatment");
    expect(row).not.toHaveProperty("stageDurations");
    expect(row).not.toHaveProperty("dailyIdHistory");
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
  }
});
