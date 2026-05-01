// Failed-batch participant UX L3 spec.
//
// Pins what a participant sees when they navigate to the player URL
// after a batch has failed to initialize (e.g. invalid treatment
// reference). The platform contract is that NoGames renders the
// "no studies available" message — not a crash, not the IdForm
// hanging forever, and not the "experiment is now closed" message
// (which is reserved for participants who registered before
// termination).
//
// What this catches that lower layers don't:
//   - PR #90 (api-driven invalidTreatment) pins the server-side flip
//     to status="failed" but says nothing about what a connecting
//     participant sees.
//   - L2 component tests for NoGames render the component in
//     isolation against synthetic player state; they don't observe
//     the App.jsx → batchConfig → NoGames discriminator chain that
//     decides which message renders, OR the server-side
//     `setCurrentlyRecruitingBatch` callback that clears
//     recruitingBatchConfig on a failed-batch transition.
//   - Solo cancel test pins "experiment is now closed" for the
//     mid-flight termination case (player registered, batch flipped
//     to terminated). The pre-registration "no studies available"
//     branch is a different code path (App.jsx's `if (!batchConfig)`
//     and isn't pinned anywhere.
//
// Why solo dir: this is a participant-browser test (no second
// participant needed). The api-driven dir is for tests where no
// browser is involved.

import { test, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

import { launchStack } from "../_helpers/empiricaServer.mjs";
import { installBrowserMocks } from "../_helpers/installBrowserMocks.mjs";
import {
  connectAsAdmin,
  readSrtoken,
  createBatch,
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
    logPrefix: "solo-failed-batch",
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

const batchConfig = (batchName, treatments) => ({
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
  treatments,
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

test("failed batch UX: participant connecting after batch fails sees NoGames 'no studies available' (not IdForm, not crash)", async ({
  page,
}) => {
  const batchName = `failed_ux_${Date.now()}`;
  const playerKey = `failed_ux_p_${Date.now()}`;

  // Create a batch with a treatment that doesn't exist in the YAML.
  // getTreatments throws → handler catches → batch.set("status", "failed")
  // → status handler fires → setCurrentlyRecruitingBatch sees no open
  // batches → clears `recruitingBatchConfig` on the global scope.
  const batchId = await createBatch(
    admin,
    batchConfig(batchName, ["this_treatment_does_not_exist"]),
  );
  await waitForAttribute(
    admin,
    batchId,
    (attrs) => attrs.status === "failed",
    { timeoutMs: 30_000 },
  );

  // Connect as a participant. The empirica client subscribes to
  // `recruitingBatchConfig` on the global scope; without one, App.jsx's
  // `!batchConfig` branch returns <NoGames />. With no `player`
  // registered yet, NoGames takes the third branch and renders
  // "no studies available". The NoGames-text waitFor below has a 30s
  // timeout, which absorbs both navigation latency AND any settle
  // window for the server-side `setCurrentlyRecruitingBatch` callback
  // (fired by the failed-status handler) to clear the recruiting
  // config — so no hard sleep is needed.
  await page.goto(`${stack.urls.player}?playerKey=${playerKey}`, {
    waitUntil: "load",
  });

  // The "no studies available" message is THE contract — distinct
  // from the "experiment is now closed" message that NoGames
  // renders for already-registered-but-incomplete players. A 30s
  // timeout covers the NoGames render itself plus any tail of the
  // server-side recruiting-config clear that closeBatch fires.
  await expect(
    page.getByText("There are no studies available at this time."),
  ).toBeVisible({ timeout: 30_000 });

  // Pin the negatives: a regression that swallowed the failure and
  // let the participant through to ID collection would render the
  // IdForm headline. A regression that flipped the wrong NoGames
  // branch would render either the closed or complete messages.
  await expect(
    page.locator('input[data-testid="inputPaymentId"]'),
    "IdForm must NOT render — failed batch can't accept new participants",
  ).toHaveCount(0);
  await expect(
    page.getByText("The experiment is now closed."),
    "wrong NoGames branch — closed message is for already-registered players",
  ).not.toBeVisible();
  await expect(
    page.getByText("Thank you for participating!"),
    "wrong NoGames branch — complete message is for finishers",
  ).not.toBeVisible();
});
