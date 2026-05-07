// Session-resumption L3 spec. Pins the contract that a participant
// who refreshes (or closes + reopens the tab) lands back where they
// were — not bounced to a fresh ID-form / consent / stage 0.
//
// What this catches that lower layers don't:
//   - L1/L2 don't observe the cross-tab session protocol — Empirica's
//     `playerKey` URL param is what re-binds a refreshing browser to
//     the existing session. Server-side `participantData` JSONL +
//     in-memory player state are the durable backing; these tests
//     confirm the loop end-to-end.
//   - The previous solo "returning participant" test (test.spec.mjs)
//     covers ACROSS-session resumption (pre-staged JSONL → revisit).
//     These tests cover WITHIN-session refresh and tab close+reopen,
//     which are the common real-world cases (participant accidentally
//     refreshes / closes the tab and clicks the recruitment URL again
//     → must not lose their place).
//
// Three resumption surfaces covered here:
//   1. Refresh mid-stage (#88, the original spec)
//   2. Refresh during intro (#118 bullet 1)
//   3. Tab close + reopen with same playerKey URL — IdForm re-submit
//      rebinds without re-doing intro (#118 bullet 2). The IdForm
//      DOES render in the fresh context (Empirica's session token
//      lives in localStorage, which is wiped with the context); the
//      contract pinned is that submitting it with the same playerKey
//      restores the existing session rather than starting a new one.
//
// Cypress 07 (Returning_Player) was retired without these specific
// branches landing as their own e2e — the existing solo test only
// asserts the deliberationId surfaces, not the stage-stickiness.

import { test, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

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
  ATTENTION_SENTENCE,
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
    logPrefix: "solo-resumption",
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

test("session resumption: refresh mid-stage lands back in the same stage with state preserved", async ({
  page,
}) => {
  const batchName = `solo_resume_${Date.now()}`;
  const playerKey = `solo_resume_p_${Date.now()}`;

  const batchId = await createBatch(
    admin,
    batchConfig({ batchName, treatments: ["solo_resumption_2stages"] }),
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

    await walkToLobby(page, { url: stack.urls.player, playerKey });

    // Confirm we're in stage 1 (resumeProbe1 prompt is what stage 1
    // renders; resumeProbe2 belongs to stage 2 and must not appear).
    const stage1 = page.locator('[data-testid="element-prompt-resumeProbe1"]');
    const stage2 = page.locator('[data-testid="element-prompt-resumeProbe2"]');
    await stage1.waitFor({ state: "visible", timeout: 60_000 });
    await expect(stage2, "stage 2 must not be rendered yet").toHaveCount(0);

    // Refresh mid-stage. The bare URL with the same playerKey is what
    // the participant's browser would re-visit on a tab close + reopen
    // OR a manual refresh — same in-session resumption path.
    await page.reload({ waitUntil: "load" });

    // After reload the participant must land back in stage 1, not at
    // consent / nickname / a fresh intro / stage 2. Wait up to 30s
    // for the reactive layer to re-establish state on a slow runner.
    await stage1.waitFor({ state: "visible", timeout: 30_000 });
    await expect(
      stage2,
      "stage 2 must NOT have rendered after refresh — that would mean state was lost or auto-advanced",
    ).toHaveCount(0);

    // Belt-and-braces: the IdForm should NOT have come back. If session
    // resumption regresses to "treat refresh as fresh visit", the
    // ID-collection input would re-render.
    await expect(
      page.locator('input[data-testid="inputPaymentId"]'),
      "IdForm must not re-render on refresh — that would mean playerKey re-binding broke",
    ).toHaveCount(0);

    // Belt-and-braces #2: Confirm the participant can still submit and
    // advance — i.e., resumed session is functionally interactive,
    // not just visually restored.
    await page.locator('[data-testid="submitButton"]').click();
    await page
      .locator('[data-testid="element-prompt-resumeProbe2"]')
      .waitFor({ state: "visible", timeout: 30_000 });
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
  }
});

test("session resumption: refresh during intro lands on the same intro step", async ({
  page,
}) => {
  const batchName = `solo_resume_intro_${Date.now()}`;
  const playerKey = `solo_resume_intro_p_${Date.now()}`;

  const batchId = await createBatch(
    admin,
    batchConfig({ batchName, treatments: ["solo_resumption_2stages"] }),
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

    // Walk through ID form + consent click. This puts the participant
    // mid-intro: consent record exists, but they have NOT yet finished
    // the attention check or chosen a nickname. The next intro step
    // (AttentionCheck — index=1, name="attentionCheck") should mount
    // automatically since checkAudio/checkVideo are false (the
    // VideoEquipmentCheck/AudioEquipmentCheck steps auto-call next()
    // when the toggles are off, see VideoEquipmentCheck.jsx:34-44).
    await registerParticipant(page, { url: stack.urls.player, playerKey });

    const idInput = page.locator('input[data-testid="inputPaymentId"]');
    const consentBtn = page.locator('button[data-testid="consentButton"]');
    const attnInput = page.locator('input[data-testid="inputAttentionCheck"]');
    const nickInput = page.locator('input[data-testid="inputNickname"]');

    await attnInput.waitFor({ state: "visible", timeout: 30_000 });
    await expect(consentBtn, "consent must be behind us").toHaveCount(0);
    await expect(idInput, "ID form must be behind us").toHaveCount(0);

    // Refresh while sitting on the AttentionCheck step. The participant
    // must land back on AttentionCheck — not bounced backward to
    // ID-form / consent (would mean playerKey re-binding broke) and
    // not auto-advanced to nickname (would mean intro state was lost).
    await page.reload({ waitUntil: "load" });

    await attnInput.waitFor({ state: "visible", timeout: 30_000 });
    await expect(
      idInput,
      "IdForm must not re-render on intro refresh — that would mean playerKey re-binding broke",
    ).toHaveCount(0);
    await expect(
      consentBtn,
      "consent must not re-render on intro refresh — that would mean intro progress was lost",
    ).toHaveCount(0);
    await expect(
      nickInput,
      "nickname must NOT have rendered after refresh — that would mean intro auto-advanced",
    ).toHaveCount(0);

    // Belt-and-braces: complete AttentionCheck and confirm the next
    // intro step (EnterNickname) renders — i.e., the resumed intro is
    // functionally interactive, not just visually restored. The
    // attention-check sentence must match `ATTENTION_SENTENCE` (which
    // is itself pinned to AttentionCheck.jsx's `originalString`); reuse
    // the helper export rather than hard-coding so a sentence change
    // upstream can't silently drift this spec out of sync.
    await attnInput.pressSequentially(ATTENTION_SENTENCE, { delay: 1 });
    await page.locator('button[data-testid="continueAttentionCheck"]').click();
    await nickInput.waitFor({ state: "visible", timeout: 15_000 });

    // And one more refresh — this time on the nickname step — to pin
    // that intro-step stickiness holds at a second distinct intro
    // index, not just the first one we landed on.
    await page.reload({ waitUntil: "load" });
    await nickInput.waitFor({ state: "visible", timeout: 30_000 });
    await expect(
      attnInput,
      "AttentionCheck must not re-render after nickname refresh — that would mean intro progress was lost",
    ).toHaveCount(0);
    await expect(
      idInput,
      "IdForm must not re-render after nickname refresh — that would mean playerKey re-binding broke",
    ).toHaveCount(0);
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
  }
});

test("session resumption: closing and reopening the tab with same playerKey rebinds to the existing session", async ({
  browser,
}) => {
  const batchName = `solo_resume_reopen_${Date.now()}`;
  const playerKey = `solo_resume_reopen_p_${Date.now()}`;

  const batchId = await createBatch(
    admin,
    batchConfig({ batchName, treatments: ["solo_resumption_2stages"] }),
  );

  // Two browser contexts so the close + reopen actually drops
  // cookies/localStorage/sessionStorage between them — the only thing
  // bridging the two is the `?playerKey=` URL param, which is exactly
  // what production recruitment URLs do (the participant clicks the
  // same MTurk link twice). A `page.reload()` would NOT exercise this
  // path — it keeps storage. A `page.close()` + `context.newPage()`
  // also keeps storage. Closing the WHOLE context is what severs it.
  const contextA = await browser.newContext();
  await installBrowserMocks(contextA);
  const pageA = await contextA.newPage();

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

    // First context: walk all the way into game stage 1 and confirm
    // the resumeProbe1 prompt is mounted. The participant is now in a
    // game-scope state (post-IdForm, post-consent, post-AC, post-
    // nickname, dispatched, position assigned).
    const nickname = `nick_${playerKey}`;
    await walkToLobby(pageA, {
      url: stack.urls.player,
      playerKey,
      nickname,
    });
    // Wait on the textarea (not just the prompt container) — stagebook
    // openResponse mounts the container before the body finishes
    // parsing, so the container becoming visible doesn't yet mean the
    // stage is interactable. Same pattern as smoke/test.spec.mjs:70-74
    // and solo/multistagePrompts.spec.mjs:118-125.
    const stage1ATextarea = pageA.locator(
      '[data-testid="element-prompt-resumeProbe1"] textarea',
    );
    await stage1ATextarea.waitFor({ state: "visible", timeout: 60_000 });

    // Close the entire context — drops all in-browser session state
    // (cookies, localStorage, sessionStorage, IndexedDB). The only
    // thing the new context will inherit is the recruitment URL with
    // its `?playerKey=` parameter.
    await contextA.close();

    // Reopen in a fresh context. Empirica's per-participant session
    // token is held in localStorage (`ns={playerKey}` in App.jsx) — a
    // brand-new browser context starts with empty storage, so the
    // IdForm will render even though the playerKey URL param matches
    // an existing tajriba session. The contract being pinned is that
    // re-submitting the IdForm with the same playerKey REBINDS to the
    // existing session (skipping consent / AC / nickname → straight
    // back to stage 1), NOT that the URL param alone resumes the
    // session silently.
    const contextB = await browser.newContext();
    await installBrowserMocks(contextB);
    const pageB = await contextB.newPage();
    try {
      const params = new URLSearchParams({ playerKey });
      await pageB.goto(`${stack.urls.player}?${params.toString()}`, {
        waitUntil: "load",
      });

      // The IdForm IS expected to mount in the fresh context — that's
      // a precondition, not a regression. Re-submit it with the same
      // playerKey (= same platformId entered in contextA's IdForm) to
      // trigger Empirica's session rebind.
      const idInputB = pageB.locator('input[data-testid="inputPaymentId"]');
      await idInputB.waitFor({ state: "visible", timeout: 30_000 });
      await idInputB.fill(playerKey);
      await pageB.locator('button[data-testid="joinButton"]').click();

      const stage1BTextarea = pageB.locator(
        '[data-testid="element-prompt-resumeProbe1"] textarea',
      );
      const stage2B = pageB.locator(
        '[data-testid="element-prompt-resumeProbe2"]',
      );
      const consentBtnB = pageB.locator('button[data-testid="consentButton"]');
      const attnInputB = pageB.locator(
        'input[data-testid="inputAttentionCheck"]',
      );
      const nickInputB = pageB.locator('input[data-testid="inputNickname"]');

      // After rebind, the participant must land back in stage 1 — same
      // place the closed tab was at. The IdForm has already been
      // submitted, so consent / AC / nickname must NOT re-render
      // (those would mean the session was treated as a brand-new
      // participant and intro state was lost).
      await stage1BTextarea.waitFor({ state: "visible", timeout: 60_000 });
      await expect(
        consentBtnB,
        "consent must not re-render after rebind — intro was already complete in the prior context",
      ).toHaveCount(0);
      await expect(
        attnInputB,
        "attention check must not re-render after rebind — intro was already complete in the prior context",
      ).toHaveCount(0);
      await expect(
        nickInputB,
        "nickname must not re-render after rebind — intro was already complete in the prior context",
      ).toHaveCount(0);
      await expect(
        stage2B,
        "stage 2 must not have auto-advanced after reopen — that would mean game state was lost",
      ).toHaveCount(0);

      // Belt-and-braces: the reopened session is functionally
      // interactive — submit advances to stage 2, the same way the
      // original tab would have. Wait on the stage 2 textarea so we're
      // pinning that the next stage is actually mounted and usable,
      // not just that its container has appeared.
      await pageB.locator('[data-testid="submitButton"]').click();
      await pageB
        .locator('[data-testid="element-prompt-resumeProbe2"] textarea')
        .waitFor({ state: "visible", timeout: 30_000 });
    } finally {
      await contextB.close();
    }
  } finally {
    // contextA may already be closed (the test path closes it
    // mid-flow), but a thrown error before that line leaves it open.
    // Guard so afterAll doesn't trip on a double-close.
    await contextA.close().catch(() => {});
    await stopBatch(admin, batchId).catch(() => {});
  }
});
