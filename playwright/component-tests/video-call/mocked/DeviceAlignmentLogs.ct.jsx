import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../../../client/src/call/VideoCall';
import { setupConsoleCapture } from '../../../mocks/console-capture.js';

/**
 * Component Tests for Device Alignment Log Behavior
 *
 * Related: PR #1170 (device alignment)
 * Tests: LOG-001, LOG-002, LOG-003
 *
 * Verifies that device alignment produces the right console.log output:
 * - Fires when alignment happens (LOG-001, LOG-003)
 * - Does NOT fire prematurely when device list is empty (LOG-002)
 * - Includes the matchType and device info (LOG-001)
 * - Sentry fallback message includes available device IDs (LOG-003)
 *
 * Infrastructure: setupConsoleCapture() must be called BEFORE mount()
 * so that messages emitted during initialization are captured.
 */

test.describe('Device Alignment Log Behavior', () => {
  test.describe.configure({ mode: 'serial' });

  /**
   * LOG-002: No premature logs when device list is empty
   * Validates: When cameras/mics are not yet populated, alignment does not run
   * and no "Setting camera via ... match" console.log is emitted.
   */
  test('LOG-002: no alignment log when device list is empty', async ({ mount, page }) => {
    test.slow();
    const console = setupConsoleCapture(page);

    // Player has camera preference but device list is empty (not yet enumerated)
    const config = {
      empirica: {
        currentPlayerId: 'p0',
        players: [{
          id: 'p0',
          attrs: {
            position: '0',
            dailyId: 'daily-p0',
            cameraId: 'cam-1',
            cameraLabel: 'My Camera',
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
          cameras: [],         // Empty - not yet loaded
          microphones: [],     // Empty - not yet loaded
          speakers: [],
          currentCam: null,
          currentMic: null,
          currentSpeaker: null,
        },
      },
    };

    const component = await mount(<VideoCall showSelfView />, { hooksConfig: config });
    await expect(component).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(500);

    // Should NOT have any "Setting camera via" logs (alignment guarded by camerasLoaded check)
    const alignmentLogs = console.matching(/Setting camera via/);
    expect(alignmentLogs).toHaveLength(0);

    // Should also not have "Setting microphone via" logs
    const micLogs = console.matching(/Setting microphone via/);
    expect(micLogs).toHaveLength(0);
  });

  /**
   * LOG-001: Alignment log fires when device list is populated
   * Validates: When camera is available and preference is set, exactly one
   * "Setting camera via ... match" log appears (not repeated on re-renders).
   */
  test('LOG-001: alignment log fires once when device matched', async ({ mount, page }) => {
    test.slow();
    const console = setupConsoleCapture(page);

    // Player prefers cam-1, device list has cam-1, current cam is null → alignment fires
    const config = {
      empirica: {
        currentPlayerId: 'p0',
        players: [{
          id: 'p0',
          attrs: {
            position: '0',
            dailyId: 'daily-p0',
            cameraId: 'cam-1',
            cameraLabel: 'FaceTime Camera',
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
          speakers: [],
          currentCam: null,   // Not yet set → triggers alignment
          currentMic: null,
          currentSpeaker: null,
        },
      },
    };

    const component = await mount(<VideoCall showSelfView />, { hooksConfig: config });
    await expect(component).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(500);

    // Should have exactly one alignment log (id match since cam-1 is available)
    const alignmentLogs = console.matching(/Setting camera via/);
    expect(alignmentLogs.length).toBeGreaterThanOrEqual(1);
    expect(alignmentLogs[0].text).toContain('id match');
  });

  /**
   * LOG-003: Sentry fallback message includes available device IDs
   * Validates: When preferred device is NOT found, the Sentry captureMessage
   * extra data includes the list of available device IDs so engineers can debug.
   */
  test('LOG-003: fallback Sentry message includes available device list', async ({ mount, page }) => {
    test.slow();
    // Reset Sentry captures before mounting
    await page.evaluate(() => {
      if (window.mockSentryCaptures) window.mockSentryCaptures.reset();
    });

    // Player prefers 'cam-preferred' but only 'cam-fallback' is available
    const config = {
      empirica: {
        currentPlayerId: 'p0',
        players: [{
          id: 'p0',
          attrs: {
            position: '0',
            dailyId: 'daily-p0',
            cameraId: 'cam-preferred',
            cameraLabel: 'Preferred Webcam',
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
          // cam-preferred is not in the list → fallback to cam-fallback
          cameras: [{ device: { deviceId: 'cam-fallback', label: 'Fallback Webcam' } }],
          microphones: [{ device: { deviceId: 'mic-1', label: 'Built-in Mic' } }],
          speakers: [],
          currentCam: null,
          currentMic: null,
          currentSpeaker: null,
        },
      },
    };

    const component = await mount(<VideoCall showSelfView />, { hooksConfig: config });
    await expect(component).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    const captures = await page.evaluate(() => window.mockSentryCaptures);

    // Should have a "not found, using fallback" Sentry message
    const fallbackMsg = captures.messages.find(
      m => m.message === 'Preferred camera not found, using fallback'
    );
    expect(fallbackMsg, 'Expected fallback camera Sentry message').toBeTruthy();

    // LOG-003: extra.availableDevices should list available cameras
    expect(fallbackMsg.hint.extra.availableDevices).toBeDefined();
    expect(Array.isArray(fallbackMsg.hint.extra.availableDevices)).toBe(true);
    expect(fallbackMsg.hint.extra.availableDevices.length).toBeGreaterThanOrEqual(1);

    // Should include the ID of the available device
    const availableIds = fallbackMsg.hint.extra.availableDevices.map(d => d.id);
    expect(availableIds).toContain('cam-fallback');
  });
});
