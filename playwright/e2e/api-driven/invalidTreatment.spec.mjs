// Invalid-treatment batch failure L3 spec.
//
// Pins the platform contract that:
//   1. Submitting a batch config with a `treatments` entry that doesn't
//      exist in the treatmentFile YAML causes the batch to flip to
//      `status: "failed"` (not crash, not silently hang in `created`).
//   2. The batch never reaches `initialized: true`.
//   3. The server doesn't write a scienceData JSONL for a never-started
//      batch — researchers should not be confused by phantom files.
//
// What this catches that lower layers don't:
//   - L1 server-vitest covers the `getTreatments` failure path (it
//     throws on unknown name) but doesn't observe the `Empirica.on
//     ("batch")` orchestration that catches the throw and flips the
//     status. That orchestration is in callbacks.js and only runs
//     against a real tajriba scope.
//   - The smoke + api-driven happy paths only exercise the success
//     branch of batch initialization, so a regression that, say,
//     swallows the throw and leaves the batch in `created` (forever
//     stuck) wouldn't be caught.
//
// Why api-driven rather than a participant browser:
//   This is purely a server contract — the failed batch never
//   accepts participants, so spinning up a browser would just sit on
//   the IdForm. api-driven is the right layer.

import { test, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readdirSync } from "fs";

import { launchStack } from "../_helpers/empiricaServer.mjs";
import {
  connectAsAdmin,
  readSrtoken,
  createBatch,
  waitForAttribute,
  getAttributes,
} from "../_helpers/empiricaAdminAPI.mjs";
import { batchConfig } from "../_helpers/batchConfig.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(__dirname, "./fixtures");

let stack;
let admin;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({}, testInfo) => {
  stack = await launchStack({
    workerIndex: testInfo.workerIndex,
    fixtureDir,
    logPrefix: "api-invalid-treatment",
  });
  admin = await connectAsAdmin({
    tajribaURL: `http://127.0.0.1:${stack.ports.empirica}/query`,
    srtoken: readSrtoken(),
  });
});

test.afterAll(async () => {
  if (stack) await stack.stop();
});

test("invalid treatment: bogus treatment name flips batch status to 'failed' (not stuck in 'created')", async () => {
  // The api-driven fixture YAML has only `smoke_2p`. We deliberately
  // request a name that isn't in it. `getTreatments` throws, the
  // surrounding try/catch in callbacks.js catches it and flips the
  // batch status to "failed".
  const batchName = `invalid_treatment_${Date.now()}`;
  const bogusName = "this_treatment_definitely_does_not_exist";

  const batchId = await createBatch(
    admin,
    batchConfig({ batchName, treatments: [bogusName] }),
  );

  // Wait for the server to react. waitForAttribute polls until the
  // predicate returns truthy. 30s is generous for what's typically a
  // sub-second flip; CI runners under load can take longer when the
  // server is also booting.
  const failedAttrs = await waitForAttribute(
    admin,
    batchId,
    (attrs) => attrs.status === "failed",
    { timeoutMs: 30_000 },
  );

  // Belt-and-braces on the failure shape:
  //
  // 1. `initialized` must NOT be true. The handler sets `initialized=true`
  //    near the END of the try block, so a throw earlier (which is what
  //    happens here when getTreatments rejects) leaves it unset. If a
  //    future refactor moves the `initialized` set above getTreatments,
  //    this assertion catches the regression — a "failed" batch
  //    shouldn't claim to be initialized.
  expect(
    failedAttrs.initialized,
    "a failed batch must not claim to be initialized",
  ).not.toBe(true);

  // 2. `validatedConfig` is set BEFORE getTreatments throws (line ~95),
  //    so it should be present on the failed batch — proving the
  //    handler at least started initialization (i.e. the batch wasn't
  //    rejected at the `addScopes` / `validateBatchConfig` layer above
  //    getTreatments). If THAT regresses, validatedConfig would be
  //    absent and we'd want to know — different bug, different fix.
  //
  //    Re-fetch attrs explicitly to make sure we see the post-throw
  //    state (waitForAttribute returns the attrs at the moment the
  //    predicate fired, but more attributes may arrive after).
  //    getAttributes returns { attrs, meta } — read the parsed attrs.
  const { attrs: finalAttrs } = await getAttributes(admin, batchId);
  expect(
    finalAttrs.validatedConfig?.batchName,
    "validatedConfig must be populated — the throw is in getTreatments, after validateBatchConfig",
  ).toBe(batchName);

  // 3. No scienceData JSONL on disk for this batch — the file is
  //    created near the END of the init block (after getTreatments
  //    succeeds), so a throw before that means no file should appear.
  //    Catches a regression where someone preemptively creates the
  //    file at the top of the handler "to be safe", littering the
  //    data directory with empty files for failed batches.
  const files = readdirSync(stack.dataDir);
  const stragglers = files.filter(
    (f) => f.includes(batchName) && f.endsWith(".scienceData.jsonl"),
  );
  expect(
    stragglers,
    `a failed batch must not produce a scienceData JSONL; got: ${stragglers.join(", ")}`,
  ).toEqual([]);
});
