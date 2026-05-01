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
  const startVideoBtn = page.locator('button[data-testid="startVideoSetup"]');
  await startVideoBtn.waitFor({ state: "visible", timeout: 30_000 });
  await startVideoBtn.click();

  // ── AudioEquipmentCheck ──────────────────────────────────────────────
  const startAudioBtn = page.locator('button[data-testid="startAudioSetup"]');
  await startAudioBtn.waitFor({ state: "visible", timeout: 30_000 });
  await startAudioBtn.click();

  // ── Nickname ─────────────────────────────────────────────────────────
  const nickInput = page.locator('input[data-testid="inputNickname"]');
  await nickInput.waitFor({ state: "visible", timeout: 30_000 });
  await nickInput.fill(nickname);
  await page.locator('button[data-testid="continueNickname"]').click();
}

// Wait for the Daily callObject diagnostic hook on `page`. App.jsx
// exposes `window.__dailyTestHook = { callObject }` after `useCallObject`
// resolves, gated on `TEST_CONTROLS=enabled` at build time.
//
// Returns a serializable snapshot of the current `participants()` map
// shape — each entry has `{ session_id, local, userData }`. Tests that
// want to inspect the live callObject use this to read state.
export async function dailyDiagSnapshot(page) {
  return page.evaluate(() => {
    // eslint-disable-next-line no-underscore-dangle
    const hook = window.__dailyTestHook;
    if (!hook?.callObject) return null;
    const co = hook.callObject;
    const parts = co.participants ? co.participants() : {};
    return {
      meetingState: co.meetingState ? co.meetingState() : null,
      subscribeToTracksAutomatically: co.subscribeToTracksAutomatically
        ? co.subscribeToTracksAutomatically()
        : null,
      participants: Object.entries(parts).map(([key, p]) => ({
        key,
        session_id: p?.session_id,
        local: !!p?.local,
        userData: p?.userData ?? null,
      })),
    };
  });
}

// Wait until the discussion call lifecycle has mounted on `page`.
// Three steps:
//
//   1. Discussion component mounted — `[data-testid="discussion"]`.
//   2. Click `[data-testid="enableContentButton"]` (the
//      DevConditionalRender "Show Content" gate around VideoCall —
//      see client/src/components/ConditionalRender.jsx). In this
//      harness `TEST_CONTROLS=enabled`, so the button is expected
//      to be present; the helper still tolerates its absence in
//      case the bundle was built differently.
//   3. VideoCall's Tray rendered — `[data-testid="reportMissing"]`
//      lives on the Tray, which only mounts inside the call UI.
//      Once it's visible the call is interactive.
//
// Tile testids deliberately not waited on here: they require an
// established WebRTC session. Tests that need a live tile can assert
// on it after this returns.
export async function waitForCallMounted(page, { timeoutMs = 90_000 } = {}) {
  const componentBudget = Math.min(60_000, timeoutMs);
  const trayBudget = timeoutMs - componentBudget;
  // `[data-testid="discussion"]` can resolve to two nodes — observed
  // in practice; likely a stagebook/adapter double-mount artifact.
  // Use waitForSelector (non-strict) so we accept any matching node
  // becoming visible rather than hard-picking the first one (which
  // might be the hidden one).
  await page.waitForSelector('[data-testid="discussion"]', {
    state: "visible",
    timeout: componentBudget,
  });
  // The "Show Content" gate. Use a short bounded wait so we tolerate
  // a small render lag between the discussion mount and the button
  // appearing — `count()` is an immediate check that can race the
  // render. If the bundle was built without TEST_CONTROLS=enabled
  // (shouldn't happen here, but defensible), the button never
  // appears and we fall through to the reportMissing wait below.
  const enableBtn = page.locator('[data-testid="enableContentButton"]').first();
  try {
    await enableBtn.waitFor({
      state: "visible",
      timeout: Math.min(2_000, trayBudget),
    });
    await enableBtn.click();
  } catch {
    // Gate absent — proceed to reportMissing wait, which will time
    // out cleanly if VideoCall isn't actually rendering.
  }
  await page
    .locator('[data-testid="reportMissing"]')
    .first()
    .waitFor({ state: "visible", timeout: trayBudget });
}
