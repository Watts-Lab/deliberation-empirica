// L3 round-trip for Etherpad + Qualtrics integrations.
//
// Replaces the integration coverage that retired with cypress 10
// (10_Etherpad_Qualtrics.js was `it.skip` because etherpad wasn't
// running in CI). The mock-server harness in _helpers/mockExternalServer.mjs
// now intercepts both providers' API calls without DNS tricks.
//
// Iframe handling — "approach A" (skip iframe content):
//   - Etherpad: SharedNotepad's iframe URL points at the mock; we don't
//     load anything in it. createPad fires on mount of the React component;
//     getText fires on unmount when the stage advances. The iframe is
//     irrelevant to the round-trip — neither side communicates through it.
//   - Qualtrics: stagebook's Qualtrics element listens for `QualtricsEOS|...`
//     postMessage from `*.qualtrics.com` origins. We simulate completion
//     by dispatching the message ourselves with `origin: "https://iad1.qualtrics.com"`.
//     The handler fires regardless of whether the iframe loaded.
//
// What this pins (vs. lower layers):
//   - L1 (server/src/providers/{etherpad,qualtrics}.test.js): individual
//     URL/auth/parsing contracts of the API calls.
//   - L2 (component-tests/.../SharedNotepad.ct.jsx PR #66): iframe
//     attribute composition, no real Empirica state.
//   - L3 (this file): the FULL chain — stagebook renders → adapter routes
//     save() to player.set/game.set → server callback fires the API call →
//     mock returns canned data → result lands in scienceData JSONL.

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

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(__dirname, "./fixtures");

let stack;
let admin;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({}, testInfo) => {
  stack = await launchStack({
    workerIndex: testInfo.workerIndex,
    fixtureDir,
    logPrefix: "solo-l3",
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

const baseBatchConfig = (batchName, treatments) => ({
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

const ATTENTION_SENTENCE =
  "I agree to participate in this study to the best of my ability.";

async function walkToGame(page, playerKey, nickname) {
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

  const attnInput = page.locator('input[data-testid="inputAttentionCheck"]');
  await attnInput.waitFor({ state: "visible", timeout: 15_000 });
  await attnInput.pressSequentially(ATTENTION_SENTENCE, { delay: 1 });
  await page.locator('button[data-testid="continueAttentionCheck"]').click();

  const nickInput = page.locator('input[data-testid="inputNickname"]');
  await nickInput.waitFor({ state: "visible", timeout: 15_000 });
  await nickInput.fill(nickname);
  await page.locator('button[data-testid="continueNickname"]').click();
}

test("etherpad + qualtrics round-trip: scienceData captures prompt_l3pad and the seeded Qualtrics survey response", async ({
  page,
}) => {
  const batchName = `solo_l3_${Date.now()}`;
  const playerKey = `solo_l3_p_${Date.now()}`;

  // Seed the qualtrics response BEFORE creating the batch so the server's
  // first fetch (when the player triggers QualtricsEOS) hits canned data.
  // The server's getQualtricsData derives responseId from sessionId via
  // FS_ → R_ replacement (providers/qualtrics.js:10), so we seed by R_.
  const surveyId = "SV_l3test";
  const sessionId = "FS_l3session";
  const responseId = "R_l3session"; // FS_ → R_ derivation
  const seededSurveyValues = {
    progress: 100,
    finished: 1,
    duration: 42,
    Q1: "I agree.",
  };
  stack.mock.seedQualtricsResponse(surveyId, responseId, {
    responseId,
    values: seededSurveyValues,
    displayedFields: ["Q1"],
    labels: {},
  });

  const batchId = await createBatch(
    admin,
    baseBatchConfig(batchName, ["solo_etherpad_qualtrics"]),
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
      {
        timeoutMs: 5_000,
      },
    );

    await walkToGame(page, playerKey, `nick_${playerKey}`);

    // ── Stage 1: Etherpad ─────────────────────────────────────────────────
    // SharedNotepad mounts when the prompt-shared-openResponse element
    // renders. The render fires `game.set("newEtherpad", ...)` →
    // server callback hits the etherpad mock's `createPad` → server
    // writes `game.set(padId, padURL)` → component receives the URL and
    // renders the iframe. We don't interact with the iframe content; the
    // round-trip is purely server-side.
    const etherpadIframe = page.locator('[data-testid="etherpad"] iframe');
    await etherpadIframe.waitFor({ state: "attached", timeout: 60_000 });
    // The iframe src points at the mock once the server populates the URL.
    // Pin that the URL is set (server round-trip succeeded) before we submit.
    await expect
      .poll(() => etherpadIframe.getAttribute("src"), { timeout: 30_000 })
      .toMatch(/\/etherpad\/p\/.+/);

    // Submit advances the stage. SharedNotepad unmounts → cleanup fires
    // `game.set("etherpadDataReady", ...)` → server callback hits the
    // etherpad mock's `getText` → server writes `game.set("prompt_l3pad", record)`.
    await page.locator('[data-testid="submitButton"]').click();

    // ── Stage 2: Qualtrics ────────────────────────────────────────────────
    // Stagebook renders an iframe at the survey URL. We don't load it —
    // we simulate end-of-survey by dispatching the postMessage stagebook
    // listens for. The Qualtrics element validates origin ends with
    // `qualtrics.com`, so we set origin accordingly.
    const qualtricsIframe = page.locator(
      `iframe[src*="qualtrics.com/jfe/form/${surveyId}"]`,
    );
    await qualtricsIframe.waitFor({ state: "attached", timeout: 60_000 });

    // Fire QualtricsEOS|surveyId|sessionId — the protocol stagebook expects
    // (see ../stagebook/.../elements/Qualtrics.tsx). onComplete = onSubmit,
    // so this also advances the stage.
    await page.evaluate(
      ({ surveyId: sId, sessionId: sessId }) => {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: `QualtricsEOS|${sId}|${sessId}`,
            origin: "https://iad1.qualtrics.com",
          }),
        );
      },
      { surveyId, sessionId },
    );

    // ── Settle + export ────────────────────────────────────────────────────
    // The qualtricsDataReady → mock fetch → player.set chain is async.
    // Wait for the mock to record the survey-response fetch before
    // calling stopBatch — otherwise closeBatch can run the scienceData
    // export *before* the player attribute lands, and qualtrics_l3survey
    // ends up missing from the JSONL.
    await expect
      .poll(
        () =>
          stack.mock.recorded.some(
            (c) =>
              c.provider === "qualtrics" &&
              c.path === `/API/v3/surveys/${surveyId}/responses/${responseId}`,
          ),
        { timeout: 15_000 },
      )
      .toBe(true);
    // Small extra window for the player.set("qualtrics_${step}", ...) to
    // propagate through Empirica's reactive layer before closeBatch fires
    // its export. The mock-call landing only tells us the fetch returned,
    // not that the attribute write has been committed.
    await page.waitForTimeout(500);

    // After stage 2 advances, the player exits the game → exportPlayer runs
    // → scienceData JSONL is written. stopBatch ensures any in-flight
    // exports complete before we read the JSONL.
    await stopBatch(admin, batchId);
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.status === "terminated",
      { timeoutMs: 15_000 },
    );
    // closeBatch + closeOutPlayer + JSONL writes are async after the
    // status flip; same settle window other solo specs use.
    await page.waitForTimeout(2000);

    // ── Assertions ────────────────────────────────────────────────────────
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
    expect(rows.length).toBe(1);

    // Etherpad: server fetched pad text via mock and stored under prompt_l3pad.
    // The mock returns the default text the server seeded at createPad
    // (the `responses` array stagebook passed in defaults to []), so the
    // value is a deterministic string controlled by the mock.
    const padRecord = rows[0].prompts?.prompt_l3pad;
    expect(padRecord, "prompt_l3pad missing from scienceData").toBeTruthy();
    expect(padRecord.name).toBe("l3pad");
    expect(typeof padRecord.value).toBe("string");

    // Qualtrics: the mock-served `result` payload lands under
    // `qualtrics_${progressLabel}` — stagebook's wrappedSave injects
    // `step: progressLabel` into every save, and the server callback
    // (callbacks.js:699) keys the player attribute by that step. So the
    // exact key is the qualtrics stage's progressLabel
    // (e.g. `qualtrics_game_1_Qualtrics_survey_stage`), NOT the
    // element name. Identify it by surveyId rather than guessing the
    // path so the test stays stable across stage renames.
    const qualtricsKeys = Object.keys(rows[0].qualtrics ?? {});
    const qualtricsRecord = qualtricsKeys
      .map((k) => rows[0].qualtrics[k])
      .find((v) => v?.surveyId === surveyId);
    expect(
      qualtricsRecord,
      `no qualtrics record with surveyId=${surveyId}; got keys: ${qualtricsKeys.join(", ")}`,
    ).toBeTruthy();
    expect(qualtricsRecord.surveyId).toBe(surveyId);
    expect(qualtricsRecord.sessionId).toBe(sessionId);
    // `data` is the full `result` object the mock returned.
    expect(qualtricsRecord.data?.values?.progress).toBe(100);
    expect(qualtricsRecord.data?.values?.Q1).toBe("I agree.");

    // Belt-and-braces: the mock recorder saw both calls fire.
    const calls = stack.mock.recorded;
    const etherpadCalls = calls.filter((c) => c.provider === "etherpad");
    expect(
      etherpadCalls.some((c) => c.path === "/api/1/createPad"),
      "etherpad createPad never reached the mock",
    ).toBe(true);
    expect(
      etherpadCalls.some((c) => c.path === "/api/1/getText"),
      "etherpad getText never reached the mock",
    ).toBe(true);
    const qualtricsCalls = calls.filter((c) => c.provider === "qualtrics");
    expect(
      qualtricsCalls.some(
        (c) => c.path === `/API/v3/surveys/${surveyId}/responses/${responseId}`,
      ),
      "qualtrics survey-response fetch never reached the mock",
    ).toBe(true);
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
  }
});
