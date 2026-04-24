// API-driven e2e spike.
//
// Drives the same smoke-test scenario as `smoke/` — create batch, put
// participants in, observe progression, stop the batch — but everything
// goes through the Tajriba GraphQL API instead of the admin UI. This
// demonstrates the control-plane surface that manager#2 needs to confirm.
//
// What this test is NOT: it doesn't drive participants through the
// browser intro flow. Those stay at "registered but not connected"
// because nothing's running a UI session for them. That's fine for
// exercising the API — progression tracking just shows them in the
// `disconnected` bucket. A hybrid test that mixes API admin + browser
// participants is a useful follow-up.

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
  listScopes,
  listParticipants,
  getAttributes,
  snapshot,
  addParticipant,
  summarizePlayerProgression,
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
    logPrefix: "api-driven",
  });

  // Connect via the empirica admin port — empirica proxies /query to
  // tajriba internally. Using the tajriba port directly (4800) works too
  // but only once tajriba is up, which launchStack doesn't explicitly
  // wait for.
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
});

test("api: create + start batch, register participants, observe state, stop", async () => {
  const batchName = `api_${Date.now()}`;

  // 1. Create the batch. Server picks up the scope via Empirica.on("batch"),
  //    runs validateBatchConfig, fetches assetsRepoSha, sets `initialized: true`
  //    on the batch attributes.
  const batchId = await createBatch(admin, baseBatchConfig(batchName));
  expect(batchId).toMatch(/^[A-Z0-9]+$/);

  // 2. Wait for server-side init (async reaction to the new scope).
  const initAttrs = await waitForAttribute(
    admin,
    batchId,
    (attrs) => attrs.initialized === true,
    { timeoutMs: 30_000 },
  );
  expect(initAttrs.validatedConfig).toMatchObject({ batchName });
  expect(initAttrs.assetsRepoSha).toMatch(/^[0-9a-f]{40}$/);
  expect(initAttrs.treatments).toBeInstanceOf(Array);

  // 3. Start the batch. Server flips into dispatch mode.
  await startBatch(admin, batchId);
  await waitForAttribute(
    admin,
    batchId,
    (attrs) => attrs.status === "running",
    { timeoutMs: 5_000 },
  );

  // 4. Register 2 participants (the API equivalent of a browser hitting
  //    /?playerKey=...). This creates tajriba participant records and
  //    session tokens, but NOT empirica "player" scopes — those are a
  //    classic-runtime construct that only browser clients produce.
  const p1 = await addParticipant(admin, `api_p1_${Date.now()}`);
  const p2 = await addParticipant(admin, `api_p2_${Date.now()}`);
  expect(p1.sessionToken).toBeTruthy();
  expect(p1.participant?.id).toBeTruthy();

  // 5. Verify the tajriba participant records exist. Note: these are NOT
  //    yet "player" scopes — those are a classic-runtime concept the
  //    browser client creates when a participant connects. API-only
  //    participants stay at the tajriba-participant layer.
  const participants = await listParticipants(admin);
  const ourIdents = new Set([
    p1.participant.identifier,
    p2.participant.identifier,
  ]);
  const ours = participants.filter((p) => ourIdents.has(p.identifier));
  expect(ours.length).toBe(2);

  // 6. Snapshot the full state — this is the "what's queryable about a
  //    study" check for the findings doc. Log it so the test output
  //    doubles as a reference.
  const snap = await snapshot(admin);
  const scopesByKind = {};
  for (const entry of snap.values()) {
    const k = entry.scope.kind || "unknown";
    scopesByKind[k] = (scopesByKind[k] || 0) + 1;
  }
  // eslint-disable-next-line no-console
  console.log("[api-driven] scope kinds visible:", scopesByKind);

  // 7. Progression summary: with no browser-driven players, buckets
  //    should all be zero since no player scopes exist yet.
  const progression = await summarizePlayerProgression(admin);
  expect(progression.buckets).toEqual(
    expect.objectContaining({
      disconnected: expect.any(Number),
      inIntro: expect.any(Number),
      inLobby: expect.any(Number),
      inGame: expect.any(Number),
      completed: expect.any(Number),
    }),
  );

  // 8. Stop the batch. Server runs closeBatch → exportScienceData for
  //    every player (even API-only ones).
  await stopBatch(admin, batchId);
  await waitForAttribute(
    admin,
    batchId,
    (attrs) => attrs.status === "terminated",
    { timeoutMs: 10_000 },
  );

  // 9. Wait for the close-out + export writes to finish.
  await new Promise((r) => setTimeout(r, 2000));

  // 10. Verify the scienceData file exists. It's written at batch-init
  //     time (empty file created) and populated per-player on close.
  //     With no player scopes (API-only, no browser clients), the file
  //     is empty — that's a true observation, not a bug. Useful finding
  //     for manager#2: the control plane alone cannot simulate complete
  //     participant flows without a browser-runtime harness.
  const files = readdirSync(stack.dataDir);
  const scienceFile = files.find(
    (f) => f.endsWith(".scienceData.jsonl") && f.includes(batchName),
  );
  expect(scienceFile).toBeTruthy();
  // eslint-disable-next-line no-console
  console.log(
    `[api-driven] scienceData size: ${
      readFileSync(join(stack.dataDir, scienceFile), "utf8").length
    } bytes`,
  );
});

// Hybrid test: admin side via API, one participant via browser. Lets us
// observe the real player-scope attribute surface (everything the browser
// client writes via player.set()) as it progresses through intro/lobby/game.
//
// This answers "what player info do we get access to as they go through
// the study?" — the exploratory question that motivated this spike.
const ATTENTION_SENTENCE =
  "I agree to participate in this study to the best of my ability.";

test("api+browser: admin via API, browser participant, watch attributes populate", async ({
  browser,
}) => {
  const batchName = `apiwatch_${Date.now()}`;
  const batchId = await createBatch(admin, baseBatchConfig(batchName));
  await waitForAttribute(
    admin,
    batchId,
    (attrs) => attrs.initialized === true,
    { timeoutMs: 30_000 },
  );
  await startBatch(admin, batchId);
  // Wait for the status flip to land before driving the browser — the
  // server needs to be in the "recruiting" state when the participant
  // connects, otherwise dispatch setup can race with the browser join.
  await waitForAttribute(
    admin,
    batchId,
    (attrs) => attrs.status === "running",
    { timeoutMs: 5_000 },
  );

  // Snapshot before any players — baseline.
  const snapBefore = await snapshot(admin);
  const kindsBefore = {};
  for (const e of snapBefore.values()) {
    kindsBefore[e.scope.kind || "?"] =
      (kindsBefore[e.scope.kind || "?"] || 0) + 1;
  }

  // Drive a single participant through the intro via real browser.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const playerKey = `apiwatch_p1_${Date.now()}`;
  await page.goto(`${stack.urls.player}?playerKey=${playerKey}`, {
    waitUntil: "load",
  });

  // Step 1: ID form. Once we submit here, a player scope exists with
  // some initial attributes.
  const idInput = page.locator('input[data-testid="inputPaymentId"]');
  await idInput.waitFor({ state: "visible", timeout: 30_000 });
  await idInput.fill(playerKey);
  await page.locator('button[data-testid="joinButton"]').click();

  // Wait for the player scope to appear in the API.
  await expectScopeOfKind(admin, "player", 30_000);
  const players1 = await listScopes(admin, { kind: "player" });
  expect(players1.length).toBe(1);
  const playerId = players1[0].id;

  // Snapshot at "post-ID-form" — capture attribute keys present.
  const afterIdForm = await getAttributes(admin, playerId);
  // eslint-disable-next-line no-console
  console.log(
    "[api-driven] attributes after ID form:",
    Object.keys(afterIdForm.attrs).sort(),
  );

  // Step 2: consent — wait for button, click.
  await page
    .locator('button[data-testid="consentButton"]')
    .waitFor({ state: "visible", timeout: 30_000 });
  await page.locator('button[data-testid="consentButton"]').click();

  // Step 3: attention check.
  const attn = page.locator('input[data-testid="inputAttentionCheck"]');
  await attn.waitFor({ state: "visible", timeout: 15_000 });
  await attn.pressSequentially(ATTENTION_SENTENCE, { delay: 1 });
  await page.locator('button[data-testid="continueAttentionCheck"]').click();

  // Step 4: nickname.
  const nick = page.locator('input[data-testid="inputNickname"]');
  await nick.waitFor({ state: "visible", timeout: 15_000 });
  await nick.fill(`nick_${playerKey}`);
  await page.locator('button[data-testid="continueNickname"]').click();

  // Now the player should be in the lobby (introDone: true, but no
  // gameId because playerCount=2 and we only have 1 player).
  await waitForAttribute(admin, playerId, (attrs) => attrs.introDone === true, {
    timeoutMs: 15_000,
  });
  const afterIntro = await getAttributes(admin, playerId);
  // eslint-disable-next-line no-console
  console.log(
    "[api-driven] attributes after intro (should show introDone):",
    Object.keys(afterIntro.attrs).sort(),
  );
  expect(afterIntro.attrs.introDone).toBe(true);
  expect(afterIntro.attrs.connected).toBe(true);
  expect(afterIntro.attrs.consent).toBeInstanceOf(Array);
  expect(afterIntro.attrs.participantData).toHaveProperty("deliberationId");

  // Progression classification: this player should be "inLobby" — waiting
  // for a second player to arrive for dispatch.
  const progression = await summarizePlayerProgression(admin);
  expect(progression.buckets.inLobby).toBe(1);
  expect(progression.buckets.inGame).toBe(0);
  expect(progression.buckets.completed).toBe(0);

  // Stop the batch — no second player is coming.
  await stopBatch(admin, batchId);
  await waitForAttribute(
    admin,
    batchId,
    (attrs) => attrs.status === "terminated",
    { timeoutMs: 10_000 },
  );
  await new Promise((r) => setTimeout(r, 2000));

  // The player should now have exitStatus set (incomplete since they
  // didn't finish the game).
  const final = await getAttributes(admin, playerId);
  // eslint-disable-next-line no-console
  console.log(
    "[api-driven] attributes after batch close:",
    Object.keys(final.attrs).sort(),
  );
  expect(final.attrs.exitStatus).toBe("incomplete");

  await ctx.close();
});

// Poll until at least one scope of `kind` exists.
async function expectScopeOfKind(client, kind, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    const list = await listScopes(client, { kind });
    if (list.length > 0) return list;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => {
      setTimeout(r, 500);
    });
  }
  throw new Error(`No scope of kind=${kind} appeared within ${timeoutMs}ms`);
}
