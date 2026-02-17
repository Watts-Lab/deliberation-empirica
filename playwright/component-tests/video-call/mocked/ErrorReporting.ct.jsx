import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../../../client/src/call/VideoCall';
import { setupConsoleCapture } from '../../../mocks/console-capture.js';

/**
 * Component Tests for A/V Error Reporting to Sentry
 *
 * Related: PR #1171 (avReports), PR #1169 (device errors)
 * Tests: ERR-001 to ERR-007
 *
 * These tests verify that VideoCall correctly reports errors to Sentry when:
 * 1. Daily fires a device error event (camera-error, mic-error, fatal-devices-error)
 * 2. Device alignment falls back to a secondary device
 * 3. A user completes the Fix A/V flow
 *
 * Infrastructure:
 * - window.mockSentryCaptures: populated by sentry-mock.js aliases
 * - window.mockCallObject: real EventEmitter from MockDailyProvider
 * - window.mockSentryCaptures.reset(): clear between sub-tests
 *
 * Note: Sentry captures are initialized fresh per page load. The describe block
 * runs serial to avoid parallel Sentry state issues.
 */

const connectedConfig = {
  empirica: {
    currentPlayerId: 'p0',
    players: [{ id: 'p0', attrs: { position: '0', dailyId: 'daily-p0', name: 'Test User' } }],
    game: { attrs: { dailyUrl: 'https://test.daily.co/room' } },
    stage: { attrs: {} },
    stageTimer: { elapsed: 0 },
  },
  daily: {
    localSessionId: 'daily-p0',
    participantIds: ['daily-p0'],
    videoTracks: { 'daily-p0': { isOff: false, subscribed: true } },
    audioTracks: { 'daily-p0': { isOff: false, subscribed: true } },
  },
};

// Config with camera preference set but current camera DIFFERENT → triggers alignment
const alignmentFallbackConfig = {
  empirica: {
    currentPlayerId: 'p0',
    players: [{
      id: 'p0',
      attrs: {
        position: '0',
        dailyId: 'daily-p0',
        name: 'Test User',
        cameraId: 'cam-preferred',
        cameraLabel: 'Preferred Camera',
      },
    }],
    game: { attrs: { dailyUrl: 'https://test.daily.co/room' } },
    stage: { attrs: {} },
    stageTimer: { elapsed: 0 },
  },
  daily: {
    localSessionId: 'daily-p0',
    participantIds: ['daily-p0'],
    videoTracks: { 'daily-p0': { isOff: false, subscribed: true } },
    audioTracks: { 'daily-p0': { isOff: false, subscribed: true } },
    // cam-preferred is NOT in the camera list → alignment falls back to cam-1
    devices: {
      cameras: [{ device: { deviceId: 'cam-1', label: 'Fallback Camera' } }],
      microphones: [{ device: { deviceId: 'mic-1', label: 'Built-in Mic' } }],
      speakers: [],
      currentCam: null,
      currentMic: { device: { deviceId: 'mic-1', label: 'Built-in Mic' } },
      currentSpeaker: null,
    },
  },
};

test.describe('A/V Error Reporting (Sentry)', () => {
  test.describe.configure({ mode: 'serial' });

  /**
   * ERR-001 & ERR-002: Daily camera-error event triggers Sentry capture
   * Validates:
   * - UserMediaError component renders on camera-error event
   * - Sentry.captureMessage("User media error") is called
   * - dailyErrorType ("not-found") is captured in the extra data
   */
  test('ERR-001/002: camera-error event triggers Sentry capture with error type', async ({ mount, page }) => {
    test.slow();
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Reset captures to start clean (any initialization breadcrumbs from mount are cleared)
    await page.evaluate(() => window.mockSentryCaptures.reset());

    // Fire a camera-error event via the mock call object event emitter
    await page.evaluate(() => {
      window.mockCallObject.emit('camera-error', {
        errorMsg: 'Camera not found',
        error: { type: 'not-found', message: 'Requested device not found' },
      });
    });

    // UserMediaError should render (device error screen shows "Camera blocked" title)
    await expect(page.locator('text=Camera blocked')).toBeVisible({ timeout: 8000 });

    // Sentry should have captured the error (UserMediaError's recordError effect runs async)
    await page.waitForTimeout(500);

    const captures = await page.evaluate(() => window.mockSentryCaptures);
    expect(captures.messages.length).toBeGreaterThanOrEqual(1);

    const errorMsg = captures.messages.find(m => m.message === 'User media error');
    expect(errorMsg, 'Expected "User media error" Sentry message').toBeTruthy();
    expect(errorMsg.hint.level).toBe('error');

    // ERR-002: daliyErrorType should be captured
    expect(errorMsg.hint.extra.dailyErrorType).toBe('not-found');
  });

  /**
   * ERR-002b: mic-error event with "permissions" error type
   * Validates: Sentry captures the Daily error type for mic errors too
   */
  test('ERR-002b: mic-error captures permissions error type', async ({ mount, page }) => {
    test.slow();
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => window.mockSentryCaptures.reset());

    await page.evaluate(() => {
      window.mockCallObject.emit('mic-error', {
        errorMsg: 'Microphone access denied',
        error: { type: 'permissions', message: 'Permission denied' },
      });
    });

    await page.waitForTimeout(500);

    const captures = await page.evaluate(() => window.mockSentryCaptures);
    const errorMsg = captures.messages.find(m => m.message === 'User media error');
    expect(errorMsg).toBeTruthy();
    expect(errorMsg.hint.extra.dailyErrorType).toBe('permissions');
  });

  /**
   * ERR-007: Summary field included in Sentry extra data
   * Validates: A one-line summary string is included at the top of extra data for easy scanning
   */
  test('ERR-007: Sentry extra includes summary string', async ({ mount, page }) => {
    test.slow();
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => window.mockSentryCaptures.reset());

    await page.evaluate(() => {
      window.mockCallObject.emit('camera-error', {
        errorMsg: 'fatal',
        error: { type: 'fatal-devices-error', message: 'No camera found' },
      });
    });

    await page.waitForTimeout(500);

    const captures = await page.evaluate(() => window.mockSentryCaptures);
    const errorMsg = captures.messages.find(m => m.message === 'User media error');
    expect(errorMsg).toBeTruthy();
    // Summary is a one-line string for easy scanning in Sentry dashboard
    expect(typeof errorMsg.hint.extra.summary).toBe('string');
    expect(errorMsg.hint.extra.summary.length).toBeGreaterThan(0);
  });

  /**
   * Device alignment breadcrumb: camera fallback triggers Sentry breadcrumb + captureMessage
   * Validates:
   * - When preferred camera is not found and fallback is used, Sentry.addBreadcrumb fires
   * - Sentry.captureMessage("Preferred camera not found, using fallback") fires
   */
  test('ERR-Breadcrumb: device alignment fallback captured in Sentry', async ({ mount, page }) => {
    test.slow();
    // Reset captures before mount so we only see alignment-related ones
    await page.evaluate(() => {
      if (window.mockSentryCaptures) window.mockSentryCaptures.reset();
    });

    const component = await mount(<VideoCall showSelfView />, { hooksConfig: alignmentFallbackConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Wait for device alignment effect to run (it's async)
    await page.waitForTimeout(1000);

    const captures = await page.evaluate(() => window.mockSentryCaptures);

    // Should have a breadcrumb for the alignment
    const alignmentBreadcrumb = captures.breadcrumbs.find(
      b => b.category === 'device-alignment'
    );
    expect(alignmentBreadcrumb, 'Expected device-alignment breadcrumb').toBeTruthy();
    expect(alignmentBreadcrumb.data.matchType).toBe('fallback');

    // Should have a captureMessage for the fallback
    const fallbackMsg = captures.messages.find(
      m => m.message === 'Preferred camera not found, using fallback'
    );
    expect(fallbackMsg, 'Expected fallback camera Sentry message').toBeTruthy();
    expect(fallbackMsg.hint.tags.deviceType).toBe('camera');
    expect(fallbackMsg.hint.extra.availableDevices).toBeDefined();
  });

  /**
   * Fix A/V flow: Sentry.captureMessage("reportedAVError") called on diagnosis
   * Validates: FixAV.jsx reports the issue to Sentry with correct tags
   */
  test('ERR-FixAV: Fix A/V completion sends reportedAVError to Sentry', async ({ mount, page }) => {
    test.slow();
    const twoPlayerConfig = {
      empirica: {
        currentPlayerId: 'p0',
        players: [
          { id: 'p0', attrs: { name: 'Player 0', position: '0', dailyId: 'daily-p0' } },
          { id: 'p1', attrs: { name: 'Player 1', position: '1', dailyId: 'daily-p1' } },
        ],
        game: { attrs: {} },
        stage: { attrs: {} },
        stageTimer: { elapsed: 0 },
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

    const component = await mount(<VideoCall showSelfView showReportMissing />, {
      hooksConfig: twoPlayerConfig,
    });
    await expect(component).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => window.mockSentryCaptures.reset());

    // Complete Fix A/V flow
    await page.locator('[data-test="fixAV"]').click();
    await expect(page.locator('text=What problems are you experiencing?')).toBeVisible({ timeout: 5000 });
    await page.locator("text=Others can't hear me").click();
    await page.locator('button:has-text("Diagnose & Fix")').click();
    await expect(page.locator('text=Attempting to fix...')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Attempting to fix...')).not.toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(500);

    const captures = await page.evaluate(() => window.mockSentryCaptures);
    const avMsg = captures.messages.find(m => m.message === 'reportedAVError');
    expect(avMsg, 'Expected reportedAVError Sentry message').toBeTruthy();
    // Should have avIssueId tag for correlation
    expect(avMsg.hint.tags.avIssueId).toBeTruthy();
  });
});
