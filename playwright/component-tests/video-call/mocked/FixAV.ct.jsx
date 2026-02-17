import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { Tray } from '../../../../client/src/call/Tray';

/**
 * Component Tests for FixAV Modal
 * Related: PR #1171, Issue #1166
 * Tests: FIXAV-001 to FIXAV-014
 *
 * Tests the Fix A/V modal workflow via the Tray component which embeds useFixAV.
 */

const twoPlayerConfig = {
  empirica: {
    currentPlayerId: 'p0',
    players: [
      { id: 'p0', attrs: { name: 'Player 0', position: '0', dailyId: 'daily-p0' } },
      { id: 'p1', attrs: { name: 'Player 1', position: '1', dailyId: 'daily-p1' } },
    ],
    game: { attrs: {} },
    stage: { attrs: {} },
  },
  daily: {
    localSessionId: 'daily-p0',
    participantIds: ['daily-p0', 'daily-p1'],
    videoTracks: {
      'daily-p0': { isOff: false, subscribed: true },
      'daily-p1': { isOff: false, subscribed: true },
    },
    audioTracks: {
      'daily-p0': { isOff: false, subscribed: true },
      'daily-p1': { isOff: false, subscribed: true },
    },
  },
};

const trayProps = {
  showReportMissing: true,
  player: null,
  stageElapsed: 0,
  progressLabel: 'test',
  audioContext: null,
  resumeAudioContext: () => Promise.resolve(),
};

/** FIXAV-001: Modal opens on Fix A/V click */
test('FIXAV-001: modal opens on Fix A/V click', async ({ mount }) => {
  const component = await mount(<Tray {...trayProps} />, { hooksConfig: twoPlayerConfig });
  await component.locator('[data-test="fixAV"]').click();
  await expect(component.locator('text=What problems are you experiencing?')).toBeVisible();
  await expect(component.locator('text=Select all that apply')).toBeVisible();
});

/** FIXAV-002: Can select multiple issues */
test('FIXAV-002: can select multiple issues', async ({ mount }) => {
  const component = await mount(<Tray {...trayProps} />, { hooksConfig: twoPlayerConfig });
  await component.locator('[data-test="fixAV"]').click();
  await component.locator("text=I can't hear other participants").click();
  await component.locator("text=Others can't hear me").click();
  await expect(component.locator('input[value="cant-hear"]')).toBeChecked();
  await expect(component.locator('input[value="others-cant-hear-me"]')).toBeChecked();
});

/** FIXAV-003: Can select "cant-hear" issue type */
test('FIXAV-003: cant-hear option available and selectable', async ({ mount }) => {
  const component = await mount(<Tray {...trayProps} />, { hooksConfig: twoPlayerConfig });
  await component.locator('[data-test="fixAV"]').click();
  await component.locator("text=I can't hear other participants").click();
  await expect(component.locator('input[value="cant-hear"]')).toBeChecked();
});

/** FIXAV-004: All issue types available for selection */
test('FIXAV-004: all issue types available', async ({ mount }) => {
  const component = await mount(<Tray {...trayProps} />, { hooksConfig: twoPlayerConfig });
  await component.locator('[data-test="fixAV"]').click();
  await expect(component.locator("text=I can't hear other participants")).toBeVisible();
  await expect(component.locator("text=I can't see other participants")).toBeVisible();
  await expect(component.locator("text=Others can't hear me")).toBeVisible();
  await expect(component.locator("text=Others can't see me")).toBeVisible();
  await expect(component.locator('text=Something else')).toBeVisible();
});

/** FIXAV-009 (partial): Cancel closes modal */
test('FIXAV-009: cancel closes modal', async ({ mount }) => {
  const component = await mount(<Tray {...trayProps} />, { hooksConfig: twoPlayerConfig });
  await component.locator('[data-test="fixAV"]').click();
  await expect(component.locator('text=What problems are you experiencing?')).toBeVisible();
  await component.locator('text=Cancel').click();
  await expect(component.locator('text=What problems are you experiencing?')).not.toBeVisible();
});

/** FIXAV-010: Diagnose & Fix button disabled with no selection */
test('FIXAV-010: Diagnose button disabled when no issue selected', async ({ mount }) => {
  const component = await mount(<Tray {...trayProps} />, { hooksConfig: twoPlayerConfig });
  await component.locator('[data-test="fixAV"]').click();
  await expect(component.locator('button:has-text("Diagnose & Fix")')).toBeDisabled();
});

/** FIXAV-010b: Diagnose & Fix button enabled after selection */
test('FIXAV-010b: Diagnose button enabled after selection', async ({ mount }) => {
  const component = await mount(<Tray {...trayProps} />, { hooksConfig: twoPlayerConfig });
  await component.locator('[data-test="fixAV"]').click();
  await component.locator("text=I can't hear other participants").click();
  await expect(component.locator('button:has-text("Diagnose & Fix")')).toBeEnabled();
});

/** FIXAV-012: Issue checkboxes toggle correctly (deselect) */
test('FIXAV-012: issue checkbox deselects on second click', async ({ mount }) => {
  const component = await mount(<Tray {...trayProps} />, { hooksConfig: twoPlayerConfig });
  await component.locator('[data-test="fixAV"]').click();
  await component.locator("text=I can't hear other participants").click();
  await expect(component.locator('input[value="cant-hear"]')).toBeChecked();
  await component.locator("text=I can't hear other participants").click();
  await expect(component.locator('input[value="cant-hear"]')).not.toBeChecked();
});

/** FIXAV-013: Issue selection state persists across clicks */
test('FIXAV-013: multiple issue selections work independently', async ({ mount }) => {
  const component = await mount(<Tray {...trayProps} />, { hooksConfig: twoPlayerConfig });
  await component.locator('[data-test="fixAV"]').click();
  await component.locator("text=I can't hear other participants").click();
  await component.locator("text=Others can't hear me").click();
  await component.locator("text=Others can't see me").click();
  // Deselect one
  await component.locator("text=Others can't hear me").click();
  await expect(component.locator('input[value="cant-hear"]')).toBeChecked();
  await expect(component.locator('input[value="others-cant-hear-me"]')).not.toBeChecked();
  await expect(component.locator('input[value="others-cant-see-me"]')).toBeChecked();
});

/** FIXAV-002b: Validates modal re-opens fresh after canceling */
test('FIXAV-002b: modal resets after cancel and reopen', async ({ mount }) => {
  const component = await mount(<Tray {...trayProps} />, { hooksConfig: twoPlayerConfig });
  // Open, select, cancel
  await component.locator('[data-test="fixAV"]').click();
  await component.locator("text=I can't hear other participants").click();
  await component.locator('text=Cancel').click();
  // Reopen - should be fresh
  await component.locator('[data-test="fixAV"]').click();
  await expect(component.locator('input[value="cant-hear"]')).not.toBeChecked();
});

/**
 * FIXAV-011: Shows success state after AudioContext fix resolves
 *
 * Tests the full diagnosis→fix→validate flow using real timers.
 *
 * Strategy:
 * - Mock window.AudioContext with a call counter so the first instantiation
 *   (before-fix diagnostics) returns state "suspended" and the second
 *   (after-fix diagnostics) returns "running".
 * - collectAVDiagnostics creates a new AudioContext each time when audioContext
 *   prop is null, so this naturally controls before/after states.
 * - resumeAudioContext is already stubbed to return Promise.resolve() in trayProps,
 *   which is sufficient for attemptSoftFixes to mark it as fixed.
 * - The 1-second await in handleSubmitFix runs in real time (acceptable with test.slow()).
 *
 * NOTE: We avoid page.clock here because fastForward() only fires timers already
 * registered at the time it's called. The setTimeout(resolve, 1000) in handleSubmitFix
 * is registered AFTER collectAVDiagnostics + attemptSoftFixes complete (~200-500ms of
 * real async work), so fastForward called immediately after clicking would miss it.
 */
test('FIXAV-011: shows success state after AudioContext fix resolves', async ({ mount, page }) => {
  test.slow();

  // Mock AudioContext with call counter:
  // - Call 1 (before-fix diagnostics): state = "suspended" → triggers audioContextSuspended cause
  // - Call 2 (after-fix diagnostics): state = "running" → cause resolved → success
  await page.evaluate(() => {
    let callCount = 0;
    window.AudioContext = function MockAudioContext() {
      callCount++;
      const state = callCount === 1 ? 'suspended' : 'running';
      return {
        state,
        addEventListener() {},
        removeEventListener() {},
        resume() { return Promise.resolve(); },
        close() { return Promise.resolve(); },
      };
    };
    window.webkitAudioContext = window.AudioContext;
  });

  const component = await mount(<Tray {...trayProps} />, { hooksConfig: twoPlayerConfig });

  // Trigger the full fix flow
  await component.locator('[data-test="fixAV"]').click();
  await component.locator("text=I can't hear other participants").click();
  await component.locator('button:has-text("Diagnose & Fix")').click();

  // Verify diagnosing state appears immediately
  await expect(component.locator('text=Attempting to fix...')).toBeVisible({ timeout: 5000 });

  // Wait for the full fix flow: async diagnostics + 1-second delay + async re-diagnostics
  // Timeout is generous since test.slow() triples the default
  // FIXAV-011: success state should be shown once fix validates
  await expect(component.locator('text=Issue resolved')).toBeVisible({ timeout: 10000 });
  await expect(component.locator('text=This dialog will close automatically...')).toBeVisible();
});

/**
 * FIXAV-005: Shows success state when mic is muted (microphoneMuted cause)
 *
 * Strategy:
 * - After mount, set window.mockCallObject._audioEnabled = false so that
 *   collectAVDiagnostics sees localAudio().enabled === false → microphoneMuted detected.
 * - attemptSoftFixes calls callObject.setLocalAudio(true) → _audioEnabled = true.
 * - Re-diagnosis after 1-second delay: localAudio().enabled === true → not detected → success.
 *
 * Only "others-cant-hear-me" is reported, so audioContextSuspended/speakerNotSet
 * (which apply to "cant-hear") are never checked, keeping this test isolated.
 */
test('FIXAV-005: shows success state when mic is muted and fix unmutes it', async ({ mount, page }) => {
  test.slow();

  const component = await mount(<Tray {...trayProps} />, { hooksConfig: twoPlayerConfig });

  // Wait for MockDailyProvider's useEffect to expose window.mockCallObject
  await page.waitForFunction(() => !!window.mockCallObject, { timeout: 15000 });

  // Set mic as muted — collectAVDiagnostics will see enabled=false → microphoneMuted
  await page.evaluate(() => { window.mockCallObject._audioEnabled = false; });

  await component.locator('[data-test="fixAV"]').click();
  await component.locator("text=Others can't hear me").click();
  await component.locator('button:has-text("Diagnose & Fix")').click();

  await expect(component.locator('text=Attempting to fix...')).toBeVisible({ timeout: 5000 });

  // Fix flow: microphoneMuted detected → setLocalAudio(true) → _audioEnabled=true →
  // re-diagnosis sees enabled=true → resolved → "Issue resolved"
  await expect(component.locator('text=Issue resolved')).toBeVisible({ timeout: 10000 });
  await expect(component.locator('text=This dialog will close automatically...')).toBeVisible();
});

/**
 * FIXAV-007: Shows success state when camera is muted (cameraMuted cause)
 *
 * Same strategy as FIXAV-005 but for camera:
 * - _videoEnabled = false → cameraMuted detected
 * - Fix: setLocalVideo(true) → _videoEnabled = true → not detected → success
 */
test('FIXAV-007: shows success state when camera is muted and fix turns it on', async ({ mount, page }) => {
  test.slow();

  const component = await mount(<Tray {...trayProps} />, { hooksConfig: twoPlayerConfig });

  await page.waitForFunction(() => !!window.mockCallObject, { timeout: 15000 });

  // Set camera as muted — collectAVDiagnostics will see enabled=false → cameraMuted
  await page.evaluate(() => { window.mockCallObject._videoEnabled = false; });

  await component.locator('[data-test="fixAV"]').click();
  await component.locator("text=Others can't see me").click();
  await component.locator('button:has-text("Diagnose & Fix")').click();

  await expect(component.locator('text=Attempting to fix...')).toBeVisible({ timeout: 5000 });

  await expect(component.locator('text=Issue resolved')).toBeVisible({ timeout: 10000 });
  await expect(component.locator('text=This dialog will close automatically...')).toBeVisible();
});

/**
 * FIXAV-014: Modal auto-closes after successful fix
 *
 * Extends FIXAV-011 by also waiting for the 2-second auto-close setTimeout to fire
 * and verifying the modal is no longer visible.
 */
test('FIXAV-014: modal auto-closes after successful fix', async ({ mount, page }) => {
  test.slow();

  await page.evaluate(() => {
    let callCount = 0;
    window.AudioContext = function MockAudioContext() {
      callCount++;
      const state = callCount === 1 ? 'suspended' : 'running';
      return {
        state,
        addEventListener() {},
        removeEventListener() {},
        resume() { return Promise.resolve(); },
        close() { return Promise.resolve(); },
      };
    };
    window.webkitAudioContext = window.AudioContext;
  });

  const component = await mount(<Tray {...trayProps} />, { hooksConfig: twoPlayerConfig });

  // Trigger the full fix flow
  await component.locator('[data-test="fixAV"]').click();
  await component.locator("text=I can't hear other participants").click();
  await component.locator('button:has-text("Diagnose & Fix")').click();

  // Wait for success state (1s delay + async diagnostics)
  await expect(component.locator('text=Issue resolved')).toBeVisible({ timeout: 10000 });

  // Wait for auto-close (2-second setTimeout fires after success)
  // FIXAV-014: modal should be closed
  await expect(component.locator('text=Issue resolved')).not.toBeVisible({ timeout: 5000 });
  await expect(component.locator('text=What problems are you experiencing?')).not.toBeVisible();
});
