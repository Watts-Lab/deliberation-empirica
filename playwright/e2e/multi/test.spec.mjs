// Multi-participant e2e — flows that need ≥2 simultaneous browser
// participants in the same game. The smoke spec runs two participants
// through a *parallel* happy path but doesn't verify cross-client
// realtime sync of any specific value; this folder is for tests that
// observe the live-subscription bridge between players.
//
// Currently covers shared-element propagation (issue #41): a player
// edits a shared prompt → the other player's DOM reflects the change
// without refreshing. Pair includes a non-shared (per-player) prompt
// to verify the negative case (player A's edit must NOT cross over).
//
// This folder is also a natural future home for cypress 03 retirement
// (text-chat propagation), and shares its multi-page setup pattern
// with #37's dropout-matrix work when that lands.

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
import { batchConfig } from "../_helpers/batchConfig.mjs";
import { walkToLobby } from "../_helpers/walkParticipant.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(__dirname, "./fixtures");

let stack;
let admin;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({}, testInfo) => {
  stack = await launchStack({
    workerIndex: testInfo.workerIndex,
    fixtureDir,
    logPrefix: "multi",
  });
  admin = await connectAsAdmin({
    tajribaURL: `http://127.0.0.1:${stack.ports.empirica}/query`,
    srtoken: readSrtoken(),
  });
});

test.afterAll(async () => {
  if (stack) await stack.stop();
});

// Multi defaults to the multi_2p_shared treatment when callers don't pass one.
const baseBatchConfig = (batchName, treatments = ["multi_2p_shared"]) =>
  batchConfig({ batchName, treatments });

test("shared element: P1's edit propagates to P2; per-player edit does not", async ({
  browser,
}) => {
  const batchName = `multi_shared_${Date.now()}`;
  const p1Key = `multi_p1_${Date.now()}`;
  const p2Key = `multi_p2_${Date.now()}`;

  const batchId = await createBatch(admin, baseBatchConfig(batchName));

  // Two independent browser contexts so each participant has their
  // own session (one localStorage / one playerKey).
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const p1 = await ctx1.newPage();
  const p2 = await ctx2.newPage();

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

    // Walk both participants to the lobby in parallel — they need to
    // arrive before the dispatcher matches them into one game.
    await Promise.all([walkToLobby(p1, { url: stack.urls.player, playerKey: p1Key }), walkToLobby(p2, { url: stack.urls.player, playerKey: p2Key })]);

    // Both participants should be dispatched into the same game stage
    // and see the shared prompt. Stagebook renders prompt-named
    // elements with `data-testid="element-prompt-{name}"` once the
    // prompt's markdown body has been fetched. Wait on the actual
    // radio inputs (not just the container) — stagebook briefly
    // renders an "Error loading prompt" placeholder if its first
    // fetch fires before batchConfig propagates, and we want to be
    // past that retry before any clicks.
    const sharedSelector = '[data-testid="element-prompt-sharedColor"]';
    const individualSelector = '[data-testid="element-prompt-individualColor"]';
    await p1.locator(`${sharedSelector} input[value="Blue"]`).waitFor({
      state: "visible",
      timeout: 60_000,
    });
    await p2.locator(`${sharedSelector} input[value="Blue"]`).waitFor({
      state: "visible",
      timeout: 60_000,
    });
    await p1.locator(`${individualSelector} input[value="Red"]`).waitFor({
      state: "visible",
      timeout: 30_000,
    });
    await p2.locator(`${individualSelector} input[value="Red"]`).waitFor({
      state: "visible",
      timeout: 30_000,
    });

    // ---- Positive case: shared edit propagates ----
    // P1 picks "Blue" on the shared prompt.
    await p1.locator(`${sharedSelector} input[value="Blue"]`).click();

    // P2's view of the same prompt should reflect "Blue" without
    // anyone refreshing — Empirica's reactive bridge fires on
    // game-scope attribute changes.
    await expect(
      p2.locator(`${sharedSelector} input[value="Blue"]`),
    ).toBeChecked({ timeout: 10_000 });

    // ---- Negative case: per-player edit stays per-player ----
    // P1 picks "Red" on the individual prompt. P2 must NOT see it.
    await p1.locator(`${individualSelector} input[value="Red"]`).click();
    // P1's own view should reflect their pick.
    await expect(
      p1.locator(`${individualSelector} input[value="Red"]`),
    ).toBeChecked();

    // Give Empirica a beat in case any (incorrect) cross-player sync
    // would happen — then assert P2's individual prompt is still
    // unselected. `expect.poll` would mask the bug; a short fixed
    // wait followed by a single assertion is the right shape.
    await p2.waitForTimeout(2_000);
    await expect(
      p2.locator(`${individualSelector} input[value="Red"]`),
    ).not.toBeChecked();

    // ---- And: independence of individual prompts ----
    // P2 picks a different value on their own individual prompt.
    // P1's individual choice should remain "Red"; P2's should be
    // "Green". Pin both to catch any bidirectional bleed.
    await p2.locator(`${individualSelector} input[value="Green"]`).click();
    await expect(
      p2.locator(`${individualSelector} input[value="Green"]`),
    ).toBeChecked();
    await expect(
      p1.locator(`${individualSelector} input[value="Red"]`),
    ).toBeChecked();
    await expect(
      p1.locator(`${individualSelector} input[value="Green"]`),
    ).not.toBeChecked();
  } finally {
    await ctx1.close();
    await ctx2.close();
    await stopBatch(admin, batchId).catch(() => {});
  }
});

test("shared listSorter: P1's keyboard reorder propagates to P2's draggable order", async ({
  browser,
}) => {
  // Replaces cypress 01:711-737 — the shared list-sorter propagation
  // case. Cypress 01 verified:
  //   1. P1 keyboard-reorders an item via space + arrow + space (the
  //      stagebook drag-handle pattern)
  //   2. After ~1s, both P1 and P2 see the new order at the
  //      draggable-N positions
  //
  // Stagebook owns the draggable component itself (ListSorter.ct.tsx
  // covers keyboard reorder mechanics in isolation). What lives at
  // L3 here is Empirica's `shared: true` propagation through the
  // stagebookAdapter — P1's onSave call should land in shared
  // game-scope state, and P2's stagebook instance should re-read it
  // and render the new order.
  const batchName = `multi_listsorter_${Date.now()}`;
  const p1Key = `multi_lsort_p1_${Date.now()}`;
  const p2Key = `multi_lsort_p2_${Date.now()}`;

  const batchId = await createBatch(
    admin,
    baseBatchConfig(batchName, ["multi_2p_listsorter"]),
  );

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const p1 = await ctx1.newPage();
  const p2 = await ctx2.newPage();

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

    await Promise.all([walkToLobby(p1, { url: stack.urls.player, playerKey: p1Key }), walkToLobby(p2, { url: stack.urls.player, playerKey: p2Key })]);

    // Wait for the listSorter to be live on both clients. The first
    // draggable item is "Harry Potter" per the prompt fixture, so
    // assert on its initial position to know the prompt finished
    // loading and rendered the source order.
    const sorterSelector = '[data-testid="element-prompt-sharedListSorter"]';
    await expect(
      p1.locator(`${sorterSelector} [data-testid="draggable-0"]`),
    ).toContainText("Harry Potter", { timeout: 60_000 });
    await expect(
      p2.locator(`${sorterSelector} [data-testid="draggable-0"]`),
    ).toContainText("Harry Potter", { timeout: 60_000 });

    // P1 keyboard-reorders: focus the first item, hit space (start),
    // arrow-down (move 1), space (drop), then blur. Same gesture
    // cypress 01 used. Stagebook's ListSorter binds these keys for
    // a11y; the resulting onSave fires once with the new order.
    const p1Item0 = p1.locator(`${sorterSelector} [data-testid="draggable-0"]`);
    await p1Item0.focus();
    await p1.keyboard.press("Space");
    await p1.keyboard.press("ArrowDown");
    await p1.keyboard.press("Space");
    // Blur the item so any "keep-focus-while-moving" UX in stagebook
    // commits the reorder.
    await p1Item0.blur();

    // P1's own view should reflect the reorder (Harry now at index 1).
    await expect(
      p1.locator(`${sorterSelector} [data-testid="draggable-1"]`),
    ).toContainText("Harry Potter", { timeout: 5_000 });

    // The actual contract: P2's view of the same shared list mirrors
    // P1's reorder. Empirica's reactive bridge propagates the new
    // value through the stagebookAdapter's `save("sharedListSorter",
    // newOrder, "shared")` call.
    await expect(
      p2.locator(`${sorterSelector} [data-testid="draggable-1"]`),
    ).toContainText("Harry Potter", { timeout: 10_000 });

    // The displaced item ("Hermione Granger" was at index 1) should
    // have moved up to index 0 on both sides — pin the inverse so a
    // regression that swapped positions silently isn't covered up.
    await expect(
      p1.locator(`${sorterSelector} [data-testid="draggable-0"]`),
    ).toContainText("Hermione Granger");
    await expect(
      p2.locator(`${sorterSelector} [data-testid="draggable-0"]`),
    ).toContainText("Hermione Granger");
  } finally {
    await ctx1.close();
    await ctx2.close();
    await stopBatch(admin, batchId).catch(() => {});
  }
});

test("text chat: messages propagate, stage scope resets, scienceData captures both stages", async ({
  browser,
}) => {
  // Replaces cypress/e2e/03_Text_Chat.js. Cypress 03 conflated several
  // concerns into one 222-line test:
  //   (a) cross-client message propagation
  //   (b) chatActions export shape (type/content/sender/stage/time)
  //   (c) chat scope resets between stages — stage 2 must not show
  //       stage 1's messages
  //   (d) title rendering parenthesization, nickname rendering
  //
  // (a) + (b) + (c) are L3-only — they exercise Empirica's reactive
  // bridge + per-stage scope semantics. (d) is rendering and lives in
  // the MessageBubble CT (component test).
  const batchName = `multi_chat_${Date.now()}`;
  const p1Key = `multi_chat_p1_${Date.now()}`;
  const p2Key = `multi_chat_p2_${Date.now()}`;

  const batchId = await createBatch(
    admin,
    baseBatchConfig(batchName, ["multi_2p_chat"]),
  );

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const p1 = await ctx1.newPage();
  const p2 = await ctx2.newPage();

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

    await Promise.all([walkToLobby(p1, { url: stack.urls.player, playerKey: p1Key }), walkToLobby(p2, { url: stack.urls.player, playerKey: p2Key })]);

    // Chat textarea has `name="message"` (TextBar.jsx); wait on that to
    // confirm the discussion column mounted in stage 1.
    const chatBox = (page) => page.locator('textarea[name="message"]');
    await chatBox(p1).waitFor({ state: "visible", timeout: 60_000 });
    await chatBox(p2).waitFor({ state: "visible", timeout: 60_000 });

    // Brief wait so `stageTimer.elapsed` is > 0 by the time the first
    // message lands. Chat.jsx records `time: stageTimer.elapsed` per
    // action; without this, the first message's time field would be
    // 0 and the export-shape assertion below ("time > 0") would fail
    // for legitimate reasons (message sent at the instant the stage
    // started).
    await p1.waitForTimeout(1500);

    // ---- Stage 1: cross-client propagation ----
    const stage1P1Msg = `s1-from-p1-${Date.now()}`;
    const stage1P2Msg = `s1-from-p2-${Date.now()}`;
    await chatBox(p1).fill(stage1P1Msg);
    await chatBox(p1).press("Enter");
    await expect(p2.locator(`text=${stage1P1Msg}`)).toBeVisible({
      timeout: 10_000,
    });
    await chatBox(p2).fill(stage1P2Msg);
    await chatBox(p2).press("Enter");
    await expect(p1.locator(`text=${stage1P2Msg}`)).toBeVisible({
      timeout: 10_000,
    });

    // ---- Stage transition: submit both players ----
    await Promise.all([
      p1.locator('[data-testid="submitButton"]').click(),
      p2.locator('[data-testid="submitButton"]').click(),
    ]);

    // Stage 2's chat textarea renders fresh — scope changes when the
    // stage advances, so the element instance is new.
    await chatBox(p1).waitFor({ state: "visible", timeout: 60_000 });
    await chatBox(p2).waitFor({ state: "visible", timeout: 60_000 });

    // Same reason as stage 1's wait — let stageTimer.elapsed cross 0
    // before sending the stage-2 message.
    await p1.waitForTimeout(1500);

    // ---- Stage scope reset (cypress 03's "messages from previous
    // chat should be gone") ----
    // Empirica's per-stage scope means stage 2's chat attribute is
    // separate from stage 1's. Stage 1 messages must NOT render here.
    await expect(p1.locator(`text=${stage1P1Msg}`)).not.toBeVisible();
    await expect(p1.locator(`text=${stage1P2Msg}`)).not.toBeVisible();
    await expect(p2.locator(`text=${stage1P1Msg}`)).not.toBeVisible();
    await expect(p2.locator(`text=${stage1P2Msg}`)).not.toBeVisible();

    // ---- Stage 2: send a message; verify it propagates ----
    const stage2P1Msg = `s2-from-p1-${Date.now()}`;
    await chatBox(p1).fill(stage2P1Msg);
    await chatBox(p1).press("Enter");
    await expect(p2.locator(`text=${stage2P1Msg}`)).toBeVisible({
      timeout: 10_000,
    });

    // ---- Stage 2 submit so its chat actions get captured ----
    await Promise.all([
      p1.locator('[data-testid="submitButton"]').click(),
      p2.locator('[data-testid="submitButton"]').click(),
    ]);

    // ---- chatActions export shape ----
    await stopBatch(admin, batchId);
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.status === "terminated",
      { timeoutMs: 10_000 },
    );
    await p1.waitForTimeout(2000); // settle window for jsonl writes

    const files = readdirSync(stack.dataDir);
    const scienceFile = files.find(
      (f) => f.endsWith(".scienceData.jsonl") && f.includes(batchName),
    );
    expect(
      scienceFile,
      `expected a scienceData jsonl for ${batchName} in ${stack.dataDir}`,
    ).toBeTruthy();

    const rows = readFileSync(join(stack.dataDir, scienceFile), "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    expect(rows.length).toBe(2);

    // chatActions is keyed by stage name and stage-scoped (same on
    // both player rows). Both stages must appear.
    const chatActions = rows[0].chatActions;
    expect(Object.keys(chatActions).sort()).toEqual([
      "First Chat",
      "Second Chat",
    ]);

    // Stage 1 actions: both messages, with the right shape.
    const s1Actions = chatActions["First Chat"];
    expect(s1Actions).toBeInstanceOf(Array);
    const s1Sent = s1Actions.filter((a) => a.type === "send_message");
    expect(s1Sent.map((a) => a.content)).toEqual(
      expect.arrayContaining([stage1P1Msg, stage1P2Msg]),
    );
    // Sender title set matches per-position titles from the fixture.
    expect(new Set(s1Sent.map((a) => a.sender?.title))).toEqual(
      new Set(["chat-pos-0", "chat-pos-1"]),
    );
    // Each action carries a non-zero timestamp (stage-relative). Pins
    // a regression where stageTimer.elapsed would feed undefined/0.
    for (const action of s1Sent) {
      expect(action.time).toEqual(expect.any(Number));
      expect(action.time).toBeGreaterThan(0);
    }
    // Each action's `stage` field follows the `game_<idx>_<stageName>`
    // shape produced by useProgressLabel. Pins the format originating
    // from Chat.jsx — without this, a regression renaming the label
    // would silently corrupt the export.
    for (const action of s1Sent) {
      expect(action.stage).toMatch(/^game_\d+_First_Chat$/);
    }

    // Stage 2 actions: only the stage-2 message, shape consistent.
    // Confirms the scope-reset on the *export* side — actions from
    // stage 1 don't leak into stage 2's bucket.
    const s2Actions = chatActions["Second Chat"];
    expect(s2Actions).toBeInstanceOf(Array);
    const s2Sent = s2Actions.filter((a) => a.type === "send_message");
    expect(s2Sent.map((a) => a.content)).toEqual([stage2P1Msg]);
    expect(s2Sent[0].stage).toMatch(/^game_\d+_Second_Chat$/);
    // Stage 1 messages must NOT have leaked into stage 2's actions —
    // pairs with the DOM assertion above for full coverage of the
    // stage-scope guarantee.
    const s2Content = s2Sent.map((a) => a.content);
    expect(s2Content).not.toContain(stage1P1Msg);
    expect(s2Content).not.toContain(stage1P2Msg);
  } finally {
    await ctx1.close();
    await ctx2.close();
    await stopBatch(admin, batchId).catch(() => {});
  }
});
