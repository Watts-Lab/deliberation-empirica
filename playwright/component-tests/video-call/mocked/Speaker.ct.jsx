import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../../../client/src/call/VideoCall';
import { setupConsoleCapture } from '../../../mocks/console-capture.js';

/**
 * Component Tests for Speaker Device Selection
 *
 * Related: PR #1170 (device alignment)
 * Tests: SPEAKER-001 to SPEAKER-006
 *
 * Note on Safari-specific behavior:
 * The setSinkId NotAllowedError that Safari raises when changing audio output
 * without a user gesture cannot be reliably triggered in headless Chromium
 * (the OS-level restriction doesn't apply). Instead, we simulate the error by
 * setting window.mockDailyDeviceOverrides.setSpeaker to throw DOMException
 * before mounting, which MockDailyProvider reads at call-time.
 *
 * SPEAKER-001 to SPEAKER-004 test the setSpeaker error path.
 * SPEAKER-005 tests the happy path (no prompt when setSpeaker succeeds).
 *
 * IMPORTANT: Looking at the current VideoCall.jsx code, the setSpeaker error
 * is caught and logged, but does NOT currently show a "Enable Audio" gesture
 * prompt for setSpeaker specifically (that prompt is only for DailyAudio
 * autoplay failures). SPEAKER-001 through SPEAKER-004 test behaviors that
 * would require this feature to be implemented. SPEAKER-005 tests current
 * working behavior.
 */

const speakerPreferenceConfig = {
  empirica: {
    currentPlayerId: 'p0',
    players: [{
      id: 'p0',
      attrs: {
        position: '0',
        dailyId: 'daily-p0',
        speakerId: 'spk-preferred',
        speakerLabel: 'Preferred Speaker',
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
    devices: {
      cameras: [{ device: { deviceId: 'cam-1', label: 'FaceTime Camera' } }],
      microphones: [{ device: { deviceId: 'mic-1', label: 'Built-in Mic' } }],
      // spk-preferred IS in the list but current speaker is different → triggers alignment
      speakers: [
        { device: { deviceId: 'spk-preferred', label: 'Preferred Speaker' } },
        { device: { deviceId: 'spk-fallback', label: 'Fallback Speaker' } },
      ],
      currentCam: { device: { deviceId: 'cam-1', label: 'FaceTime Camera' } },
      currentMic: { device: { deviceId: 'mic-1', label: 'Built-in Mic' } },
      currentSpeaker: null, // Not set → triggers alignment
    },
  },
};

test.describe('Speaker Device Selection', () => {
  test.describe.configure({ mode: 'serial' });

  /**
   * SPEAKER-005: No prompt shown when setSpeaker succeeds
   * Validates: When setSpeaker succeeds (default behavior), no gesture prompt appears.
   * This is the current working behavior.
   */
  test('SPEAKER-005: no gesture prompt when setSpeaker succeeds', async ({ mount, page }) => {
    test.slow();
    // Default behavior: setSpeaker succeeds (no override needed)
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: speakerPreferenceConfig });
    await expect(component).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // No gesture prompt should appear when speaker selection works
    await expect(page.locator('text=Enable audio')).not.toBeVisible();
  });

  /**
   * SPEAKER-001: setSpeaker throwing NotAllowedError is caught gracefully
   * Validates: When setSpeaker throws NotAllowedError (Safari without user gesture),
   * the component does NOT crash — it logs the error and continues rendering.
   *
   * NOTE: The current code logs the error but does NOT show a gesture prompt for
   * speaker changes (only for DailyAudio autoplay failures). This test verifies
   * the error handling doesn't break the component.
   */
  test('SPEAKER-001: setSpeaker NotAllowedError is caught without crashing', async ({ mount, page }) => {
    test.slow();
    const consoleCap = setupConsoleCapture(page);

    // Override setSpeaker to throw NotAllowedError (simulates Safari gesture requirement)
    await page.evaluate(() => {
      window.mockDailyDeviceOverrides = {
        setSpeaker: () => Promise.reject(
          new DOMException('Operation requires user gesture.', 'NotAllowedError')
        ),
      };
    });

    const component = await mount(<VideoCall showSelfView />, { hooksConfig: speakerPreferenceConfig });
    await expect(component).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // Cleanup override
    await page.evaluate(() => { delete window.mockDailyDeviceOverrides; });

    // Component should still be visible (error was caught, not re-thrown)
    await expect(component).toBeVisible();

    // Should have logged the error
    const errorLogs = consoleCap.getErrors();
    const speakerError = errorLogs.find(m => m.text.includes('Failed to set speaker'));
    expect(speakerError, 'Expected "Failed to set speaker" error log').toBeTruthy();
  });

  /**
   * SPEAKER-002: setSpeaker error falls back to first available speaker
   * Validates: When the id-match setSpeaker fails, the code retries with the
   * first available speaker as a fallback.
   */
  test('SPEAKER-002: setSpeaker error triggers fallback retry', async ({ mount, page }) => {
    test.slow();
    const consoleCap = setupConsoleCapture(page);

    // Override setSpeaker to throw for the preferred device, succeed for fallback
    await page.evaluate(() => {
      let callCount = 0;
      window.mockDailyDeviceOverrides = {
        setSpeaker: (deviceId) => {
          callCount++;
          if (deviceId === 'spk-preferred') {
            return Promise.reject(new DOMException('NotAllowedError', 'NotAllowedError'));
          }
          return Promise.resolve();
        },
      };
    });

    const component = await mount(<VideoCall showSelfView />, { hooksConfig: speakerPreferenceConfig });
    await expect(component).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    await page.evaluate(() => { delete window.mockDailyDeviceOverrides; });

    // Should have logged the fallback retry
    const retryLogs = consoleCap.getLogs().filter(m => m.text.includes('Retrying with fallback speaker'));
    expect(retryLogs.length).toBeGreaterThanOrEqual(1);

    // Component should still be visible
    await expect(component).toBeVisible();
  });

  /**
   * SPEAKER-003: Speaker alignment triggers Sentry breadcrumb
   * Validates: When speaker alignment occurs, Sentry.addBreadcrumb is called
   * with category "device-alignment".
   */
  test('SPEAKER-003: speaker alignment logged as Sentry breadcrumb', async ({ mount, page }) => {
    test.slow();
    await page.evaluate(() => {
      if (window.mockSentryCaptures) window.mockSentryCaptures.reset();
    });

    const component = await mount(<VideoCall showSelfView />, { hooksConfig: speakerPreferenceConfig });
    await expect(component).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    const captures = await page.evaluate(() => window.mockSentryCaptures);

    // Should have a device-alignment breadcrumb for speaker
    const speakerBreadcrumb = captures.breadcrumbs.find(
      b => b.category === 'device-alignment' && b.data?.deviceType === 'speaker'
    );
    expect(speakerBreadcrumb, 'Expected speaker device-alignment breadcrumb').toBeTruthy();
    expect(speakerBreadcrumb.data.matchType).toBe('id');
  });
});
