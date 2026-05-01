// Shared helpers for L3 video specs (`playwright/e2e/video/`).
//
// Walks a participant past the intro chain that batches with
// `checkVideo: true` / `checkAudio: true` always include — beyond the
// standard ID + consent + AC + nickname flow:
//
//   - PreIdChecks: 3 confirmation checkboxes (webcam / mic / headphones)
//     gating the joinButton (CheckboxGroup keyed on labels).
//   - VideoEquipmentCheck: data-testid="startVideoSetup" → after click,
//     production code's `window.__skipEquipmentChecks` bypass auto-passes
//     `permissionsStatus` + `webcamStatus` and the component's own
//     useEffect calls `next()` to advance.
//   - AudioEquipmentCheck: data-testid="startAudioSetup" → same shape,
//     bypass auto-passes the four sub-statuses and advances.
//
// The bypass is build-time gated on `TEST_CONTROLS=enabled`, which the
// e2e harness already sets in startEmpirica (empiricaServer.mjs). We
// just need to set the global on each page before navigation:
//
//     await page.addInitScript(() => {
//       window.__skipEquipmentChecks = true;
//     });
//
// Without this, MicCheck + LoopbackCheck would block on real audio
// analysis (level threshold + tone detection in playback) which is
// undefined behavior with the synthetic `--use-fake-device-for-media-stream`
// tracks. The bypass short-circuits before the analysis runs.

const ATTENTION_SENTENCE =
  "I agree to participate in this study to the best of my ability.";

export async function bypassEquipmentChecks(page) {
  // Must be called before page.goto so the global is in place when the
  // VideoEquipmentCheck / AudioEquipmentCheck useEffect runs.
  await page.addInitScript(() => {
    // eslint-disable-next-line no-underscore-dangle
    window.__skipEquipmentChecks = true;
  });
}

// Walks a participant from a fresh navigation through the full
// video-enabled intro chain to the start of the game stage.
//
// `playerUrl` is the base URL (e.g. stack.urls.player). `playerKey`
// becomes both the URL query param and the inputPaymentId value
// (matches the existing solo pattern). `nickname` is the value
// typed into EnterNickname.
//
// Caller is responsible for `bypassEquipmentChecks(page)` before
// invoking this helper.
export async function walkThroughVideoIntro(
  page,
  { playerUrl, playerKey, nickname },
) {
  await page.goto(`${playerUrl}?playerKey=${playerKey}`, {
    waitUntil: "load",
  });

  // ── ID form + PreIdChecks ────────────────────────────────────────────
  // PreIdChecks renders three checkboxes inside a CheckboxGroup with
  // testid="checks". The labels are exactly the values defined in
  // PreIdChecks.jsx — match by label so we don't depend on the
  // CheckboxGroup's internal DOM structure.
  //
  // Use `.click()` not `.check()`: once the third box is ticked,
  // PreIdChecks calls setChecksPassed(true) and IdForm unmounts the
  // whole `<PreIdChecks />` subtree on the next render. `.check()`'s
  // post-click verify-state step then hangs waiting for the
  // now-unmounted element to confirm checked. `.click()` skips that
  // verify step.
  await page.getByLabel("I have a working webcam").click();
  await page.getByLabel("I have a working microphone").click();
  await page.getByLabel("I have working headphones or earbuds").click();

  const idInput = page.locator('input[data-testid="inputPaymentId"]');
  await idInput.waitFor({ state: "visible", timeout: 30_000 });
  await idInput.fill(playerKey);
  await page.locator('button[data-testid="joinButton"]').click();

  // ── Consent ──────────────────────────────────────────────────────────
  const consentBtn = page.locator('button[data-testid="consentButton"]');
  await consentBtn.waitFor({ state: "visible", timeout: 30_000 });
  await consentBtn.click();

  // ── Attention check ──────────────────────────────────────────────────
  const attnInput = page.locator('input[data-testid="inputAttentionCheck"]');
  await attnInput.waitFor({ state: "visible", timeout: 15_000 });
  await attnInput.pressSequentially(ATTENTION_SENTENCE, { delay: 1 });
  await page.locator('button[data-testid="continueAttentionCheck"]').click();

  // ── VideoEquipmentCheck ──────────────────────────────────────────────
  // Click "Begin camera setup". The bypass useEffect (gated on
  // TEST_CONTROLS=enabled + window.__skipEquipmentChecks) auto-passes
  // permissionsStatus + webcamStatus once flowStatus="started", and
  // the component's own next() effect advances to AudioEquipmentCheck.
  const startVideoBtn = page.locator(
    'button[data-testid="startVideoSetup"]',
  );
  await startVideoBtn.waitFor({ state: "visible", timeout: 30_000 });
  await startVideoBtn.click();

  // ── AudioEquipmentCheck ──────────────────────────────────────────────
  const startAudioBtn = page.locator(
    'button[data-testid="startAudioSetup"]',
  );
  await startAudioBtn.waitFor({ state: "visible", timeout: 30_000 });
  await startAudioBtn.click();

  // ── Nickname ─────────────────────────────────────────────────────────
  const nickInput = page.locator('input[data-testid="inputNickname"]');
  await nickInput.waitFor({ state: "visible", timeout: 30_000 });
  await nickInput.fill(nickname);
  await page.locator('button[data-testid="continueNickname"]').click();
}

// Wait until the discussion call lifecycle has mounted on `page` —
// any of the four tile testids client/.../call/Tile.jsx can render.
// 90s timeout covers cold WebRTC negotiation + lobby quorum waits in
// multi-player specs.
export async function waitForCallMounted(page, { timeoutMs = 90_000 } = {}) {
  const tile = page
    .locator(
      [
        '[data-testid="callTile"]',
        '[data-testid="videoMutedTile"]',
        '[data-testid="audioOnlyTile"]',
        '[data-testid="waitingParticipantTile"]',
      ].join(", "),
    )
    .first();
  await tile.waitFor({ state: "visible", timeout: timeoutMs });
}
