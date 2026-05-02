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
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "fs";

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
import {
  registerParticipant,
  walkToLobby,
} from "../_helpers/walkParticipant.mjs";

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

// Install ipwho.is + VPN-list mocks on every test's browser context.
// Consent.jsx fires both calls; without mocks the tests hit the real
// network (non-deterministic country, GitHub rate limits). The solo
// trackedLink test additionally installs them on its own context
// (created via `browser.newContext()`); this hook covers tests that
// use the default `page` fixture.
test.beforeEach(async ({ page }) => {
  await installBrowserMocks(page.context());
});

// Solo defaults to the solo_1p treatment when callers don't pass one.
const baseBatchConfig = (batchName, treatments = ["solo_1p"]) =>
  batchConfig({ batchName, treatments });

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

    await registerParticipant(page, { url: stack.urls.player, playerKey });

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

test("returning participant: pre-existing participantData JSONL surfaces deliberationId on the player", async ({
  page,
}) => {
  // Replaces cypress/e2e/07_Returning_Player.js. The behavior under test:
  // when a player connects with a platformId that already has a
  // participantData JSONL on disk (from a prior session), the server's
  // `getParticipantData` (server/src/postFlight/exportParticipantData.js)
  // reads the file, surfaces the recorded `deliberationId` onto the
  // player attribute `participantData`, and the EmpiricaMenu's hidden
  // `playerDeliberationId` input renders that exact value.
  //
  // We pre-stage the JSONL before the participant navigates so the
  // server initialization path takes the read branch (not the
  // create-new branch), then walk the participant to the consent
  // screen — which is where the EmpiricaMenu is mounted and the input
  // is reachable.
  const batchName = `solo_returning_${Date.now()}`;
  const playerKey = `solo_returning_p_${Date.now()}`;
  const seededDeliberationId = `seeded_delib_${Date.now()}`;

  // Pre-stage the JSONL. The directory layout — one file per platformId
  // under <DATA_DIR>/participantData/ — is owned by exportParticipantData.js;
  // mirror it here so the server's read path matches the seeded file.
  const participantDataDir = join(stack.dataDir, "participantData");
  mkdirSync(participantDataDir, { recursive: true });
  const participantDataLines = [
    {
      type: "meta",
      key: "platformId",
      val: playerKey,
      ts: new Date().toISOString(),
    },
    {
      type: "meta",
      key: "deliberationId",
      val: seededDeliberationId,
      ts: new Date().toISOString(),
    },
  ]
    .map((line) => JSON.stringify(line))
    .join("\n");
  writeFileSync(
    join(participantDataDir, `${playerKey}.jsonl`),
    participantDataLines,
    "utf8",
  );

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

    // Walk the participant past the ID form. The platformId we enter
    // here MUST match the JSONL filename — the server keys participant
    // data lookups by platformId, so a mismatch silently routes the
    // player into the create-new branch and the seeded value would
    // never surface.
    await registerParticipant(page, { url: stack.urls.player, playerKey });

    // The EmpiricaMenu mounts after consent. The `playerDeliberationId`
    // input is rendered with `hidden`, so use `getAttribute("value")`
    // rather than locator.inputValue() (which only reads .value via
    // the DOM property; both are equivalent for the assertion but the
    // attribute form makes the hidden-input intent explicit).
    const idInput = page.locator('input[data-testid="playerDeliberationId"]');
    await idInput.waitFor({ state: "attached", timeout: 30_000 });
    // `participantData` is set server-side via `player.set(...)` and
    // flows reactively into the React `value`. Poll with an explicit
    // 15s timeout so a slow server-side initialization fails the
    // assertion loud rather than silently flaking on the default 5s.
    await expect
      .poll(() => idInput.getAttribute("value"), { timeout: 15_000 })
      .toBe(seededDeliberationId);
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
  }
});

test("trackedLink: click + blur/focus opens the submit gate; scienceData captures the record shape", async ({
  browser,
}) => {
  // Replaces cypress 01:773-829 + 1119-1131 — the tracked-link
  // exit-flow contract. After deliberation-lab/stagebook#233 landed
  // upstream (and stagebook 0.8.2 was published), the *element*
  // behaviors are pinned upstream:
  //   - entryUrl.params resolution + URL-encoding + empty-value rendering
  //   - click event capture, blur/focus accumulation, totalTimeAwaySeconds
  //   - target=_blank + rel attrs + helper text
  //
  // What stays at L3 is the integration: stagebook's save() →
  // platform's stagebookAdapter writes `trackedLink_followupLink`
  // attribute → reference resolver reads `trackedLink.followupLink.events`
  // → StageConditionGate ungates the submitButton. Plus the
  // scienceData export's `trackedLinks` round-trip.
  const batchName = `solo_trackedlink_${Date.now()}`;
  const playerKey = `solo_tl_p_${Date.now()}`;

  // Create the batch BEFORE allocating the browser context so that
  // a createBatch failure doesn't leak the context (afterAll's
  // stack.stop() only kills empirica + cdn, not Playwright contexts).
  const batchId = await createBatch(
    admin,
    baseBatchConfig(batchName, ["solo_trackedlink"]),
  );

  const ctx = await browser.newContext();
  await installBrowserMocks(ctx);
  const page = await ctx.newPage();

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

    const nickname = `nick_${playerKey}`;
    // Walk through the full intro into the lobby — the trackedLink
    // element waitFor below is what gates on game-stage mount.
    await walkToLobby(page, { url: stack.urls.player, playerKey, nickname });

    // Wait for the tracked-link element to land. Stagebook renders
    // it under `data-testid="element-trackedLink-{name}"`.
    const linkBlock = page.locator(
      '[data-testid="element-trackedLink-followupLink"]',
    );
    await linkBlock.waitFor({ state: "visible", timeout: 60_000 });

    // Sanity-check the resolved href before clicking — pins the
    // platform's role in `participantInfo.name` URL-encoding (via
    // the stagebookAdapter's synthesize logic) and the empty-value
    // `flag=` rendering.
    const anchor = linkBlock.locator("a");
    const href = await anchor.getAttribute("href");
    expect(href).toContain("https://example.org/followup?");
    expect(href).toContain(`participant=${encodeURIComponent(nickname)}`);
    expect(href).toMatch(/[?&]playerKey=[^&]+/);
    // Empty-value urlParam: stagebook should render `&flag=` (key
    // present, value empty) rather than dropping it.
    expect(href.endsWith("flag=")).toBe(true);

    // Submit button should NOT be present yet — the StageConditionGate
    // gate keys on `trackedLink.followupLink.events.length >= 1`.
    await expect(page.locator('[data-testid="submitButton"]')).toHaveCount(0);

    // Mutate the anchor before click so it stays in-tab (otherwise
    // target=_blank opens a new page and we'd need popup handling).
    // Same trick cypress 01:809-812 used.
    await anchor.evaluate((el) => {
      el.setAttribute("href", "#");
      el.setAttribute("target", "_self");
    });
    await anchor.click();

    // Simulate the user leaving the tab (blur) and returning (focus).
    // Stagebook's TrackedLink uses these events to accumulate
    // `totalTimeAwaySeconds`.
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.waitForTimeout(120);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));

    // Now the submit button should appear — events.length === 1
    // satisfies the `isAtLeast 1` gate.
    await page
      .locator('[data-testid="submitButton"]')
      .waitFor({ state: "visible", timeout: 10_000 });
    await page.locator('[data-testid="submitButton"]').click();

    // Stop the batch so closeOutPlayer runs the scienceData export
    // for the in-flight participant.
    await stopBatch(admin, batchId);
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.status === "terminated",
      { timeoutMs: 10_000 },
    );
    await page.waitForTimeout(2000); // settle window for JSONL writes

    // Assert the scienceData export captures the trackedLink record
    // with the contract cypress 01:1119-1131 pinned.
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

    const record = rows[0].trackedLinks?.trackedLink_followupLink;
    expect(record, "trackedLink_followupLink record missing").toBeTruthy();
    expect(record.url).toBe("https://example.org/followup");
    expect(record.displayText).toBe("Complete the external signup form");
    expect(Array.isArray(record.events)).toBe(true);
    const eventTypes = record.events.map((e) => e.type);
    expect(eventTypes).toContain("click");
    // totalTimeAwaySeconds accumulates via blur/focus — must be > 0.
    expect(record.totalTimeAwaySeconds).toBeGreaterThan(0);
  } finally {
    await ctx.close();
    await stopBatch(admin, batchId).catch(() => {});
  }
});
