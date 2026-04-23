import { test, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, resolve, join } from "path";
import { readdirSync, readFileSync } from "fs";

import { launchStack } from "../_helpers/empiricaServer.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(__dirname, "./fixtures");

const ATTENTION_SENTENCE =
  "I agree to participate in this study to the best of my ability.";

let stack;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({}, testInfo) => {
  stack = await launchStack({
    workerIndex: testInfo.workerIndex,
    fixtureDir,
    logPrefix: "smoke",
  });
});

test.afterAll(async () => {
  if (stack) await stack.stop();
});

// Drive the admin UI to create and start a batch pointed at this worker's
// fixture CDN. Returns the batch name so tests can find the JSONL file later.
async function createAndStartBatch(page) {
  const batchName = `smoke_${Date.now()}`;
  const config = {
    batchName,
    // Server's zod schema restricts cdn to "test"/"prod"/"local"; the
    // helper injects CDN_TEST_URL so "test" resolves to this worker's CDN.
    cdn: "test",
    treatmentFile: "study.treatments.yaml",
    customIdInstructions: "none",
    platformConsent: "US",
    consentAddendum: "none",
    debrief: "none",
    checkAudio: false,
    checkVideo: false,
    introSequence: "none",
    treatments: ["smoke_2p"],
    payoffs: "equal",
    knockdowns: "none",
    dispatchWait: 1,
    launchDate: "immediate",
    centralPrereg: false,
    preregRepos: [],
    dataRepos: [],
    videoStorage: "none",
    exitCodes: "none",
  };

  await page.goto(stack.urls.admin, { waitUntil: "load" });
  await page.locator('button[data-test="newBatchButton"]').click();
  await page.locator('button[data-test="customAssignmentButton"]').click();
  const textarea = page.locator('textarea[data-test="configurationTextArea"]');
  await textarea.fill(JSON.stringify(config, null, 2));
  await page.locator('[data-test="createBatchButton"]').click();
  // Start button appears once validation passes and the batch is ready.
  const startBtn = page.locator('[data-test="startButton"]').first();
  await startBtn.waitFor({ state: "visible", timeout: 30_000 });
  await startBtn.click();
  // After starting, a stopButton replaces the startButton.
  await page.locator('[data-test="stopButton"]').first().waitFor({
    state: "visible",
    timeout: 15_000,
  });
  return { batchName };
}

// Drive one participant from landing page through the game stage submit.
async function runParticipant(page, { playerKey }) {
  await page.goto(`${stack.urls.player}?playerKey=${playerKey}`, {
    waitUntil: "load",
  });

  // ID form ("Please enter the identifier assigned by your recruitment
  // platform."). With customIdInstructions: "none" we still see the form;
  // the instructions text just defaults. Paste the playerKey in to satisfy
  // validation.
  const idInput = page.locator('input[data-testid="inputPaymentId"]');
  await idInput.waitFor({ state: "visible", timeout: 30_000 });
  await idInput.fill(playerKey);
  await page.locator('button[data-testid="joinButton"]').click();

  // Consent (platformConsent: "US" makes this mandatory)
  const consentBtn = page.locator('button[data-testid="consentButton"]');
  await consentBtn.waitFor({ state: "visible", timeout: 30_000 });
  await consentBtn.click();

  // Attention check — paste is blocked; type the exact sentence.
  const attnInput = page.locator('input[data-testid="inputAttentionCheck"]');
  await attnInput.waitFor({ state: "visible", timeout: 15_000 });
  await attnInput.pressSequentially(ATTENTION_SENTENCE, { delay: 1 });
  await page.locator('button[data-testid="continueAttentionCheck"]').click();

  // Nickname
  const nickInput = page.locator('input[data-testid="inputNickname"]');
  await nickInput.waitFor({ state: "visible", timeout: 15_000 });
  await nickInput.fill(`nick_${playerKey}`);
  await page.locator('button[data-testid="continueNickname"]').click();

  // Lobby → dispatched into game stage. The game stage renders the prompt
  // we declared in the fixture plus a submit button.
  const submitBtn = page.locator('[data-testid="submitButton"]');
  await submitBtn.waitFor({ state: "visible", timeout: 60_000 });
  // Fill the open-response textarea so the submit isn't blocked by validation.
  const promptBox = page.locator(
    '[data-testid="element-prompt-smokePrompt"] textarea',
  );
  if (await promptBox.count()) {
    await promptBox.fill("hello from smoke");
  }
  await submitBtn.click();
}

test("smoke: admin creates batch, two participants play through, data exported", async ({
  browser,
}) => {
  // 1. Admin: create + start batch (own context so admin cookies don't bleed
  //    into participant pages).
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  const { batchName } = await createAndStartBatch(adminPage);

  // 2. Two participants in parallel, each in its own context (separate
  //    Empirica player sessions).
  const p1Context = await browser.newContext();
  const p2Context = await browser.newContext();
  const p1 = await p1Context.newPage();
  const p2 = await p2Context.newPage();

  await Promise.all([
    runParticipant(p1, { playerKey: `smoke_p1_${Date.now()}` }),
    runParticipant(p2, { playerKey: `smoke_p2_${Date.now()}` }),
  ]);

  // 3. Admin stops the batch — that's what triggers closeOutPlayer →
  //    exportScienceData for any players who didn't finish QC. Clicking
  //    Stop pops a window.confirm; accept it via Playwright's dialog
  //    handler before the click fires.
  adminPage.once("dialog", (dialog) => dialog.accept());
  await adminPage.locator('[data-test="stopButton"]').first().click();
  // Wait for the batch to actually flip to terminated before reading the
  // file. Empirica's admin UI removes the Stop button (and shows "Ended")
  // once the server has closed the batch.
  await adminPage
    .locator('[data-test="stopButton"]')
    .first()
    .waitFor({ state: "detached", timeout: 15_000 });
  // closeOutPlayer runs async after status change; a small settle window
  // lets the JSONL writes land.
  await adminPage.waitForTimeout(2000);

  // 4. Find the scienceData JSONL (filename includes a server-side timestamp
  //    prefix so we can't predict it exactly; match by batchName suffix).
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
  const lines = body.split("\n").filter(Boolean);
  expect(lines.length, "expected one scienceData row per participant").toBe(2);

  // Each row should be valid JSON with the core platform-populated keys.
  for (const line of lines) {
    const row = JSON.parse(line);
    expect(row).toHaveProperty("batchId");
    expect(row).toHaveProperty("sampleId");
    expect(row).toHaveProperty("deliberationId");
    expect(row).toHaveProperty("treatment");
    expect(row).toHaveProperty("exitStatus");
    // assetsRepoSha is stamped at batch init (GitHub ref lookup via mock);
    // the mock returns a deterministic 40-hex sha.
    expect(row.assetsRepoSha).toMatch(/^[0-9a-f]{40}$/);
  }

  // 5. The server hits GitHub on batch init to fetch the deliberation-assets
  //    head sha (getAssetsRepoSha → getRepoHeadSha). Verify the mock
  //    intercepted that call — proves the mock is wired up end-to-end
  //    without requiring us to configure preregRepos/dataRepos.
  const githubCalls = stack.mock.recorded.filter(
    (r) => r.provider === "github",
  );
  expect(
    githubCalls.length,
    "expected the server to hit the GitHub mock at least once during batch init",
  ).toBeGreaterThan(0);
  // All GitHub calls should have passed our spec-driven auth check
  // (otherwise they'd be 401s), proving the server is sending a
  // well-formed Authorization header.
  for (const call of githubCalls) {
    expect(
      call.responseStatus,
      `github ${call.method} ${call.path} returned ${call.responseStatus}`,
    ).toBeLessThan(400);
  }

  await adminContext.close();
  await p1Context.close();
  await p2Context.close();
});
