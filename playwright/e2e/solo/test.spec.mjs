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
import { dirname, resolve } from "path";

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
