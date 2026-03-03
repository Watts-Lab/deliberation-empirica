import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../../../client/src/call/VideoCall';

/**
 * Component Tests for Speaker/Output Device Recovery
 *
 * Unlike camera and microphone (where Daily fires camera-error/mic-error events),
 * speaker disconnection fires NO Daily event. The OS silently routes audio to the
 * next available device, and only the device alignment effect can detect the change.
 *
 * The fix (Issue #1190): when alignSpeaker() finds only a fallback match (preferred
 * device gone), it now sets a speaker-error instead of silently switching — showing
 * a picker so the user is aware and in control.
 *
 * These tests are in a separate file from VideoCall.deviceRecovery.ct.jsx because
 * speaker picker tests need enumerateDevices to return audiooutput devices, while
 * camera/mic picker tests mock it without audiooutput. Running in the same file
 * with fullyParallel:true causes webkit to have the mocks overwrite each other.
 */

/**
 * Config that simulates a monitor speaker that has been unplugged:
 * - Player's preferred speaker = monitor (not in devices.speakers)
 * - Current speaker (auto-switched by OS) = built-in
 * - devices.speakers = [built-in only]
 *
 * The device alignment effect fires because currentSpeaker !== preferredSpeaker.
 * alignSpeaker() finds no ID/label match → fallback → should show picker.
 */
const configWithMissingSpeaker = {
  empirica: {
    currentPlayerId: 'p0',
    players: [{
      id: 'p0',
      attrs: {
        name: 'Test User',
        position: '0',
        dailyId: 'daily-p0',
        speakerId: 'monitor-speaker-id',
        speakerLabel: 'DELL U3415W Audio',
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
      speakers: [
        { device: { deviceId: 'builtin-speaker-id', label: 'MacBook Pro Speakers' } },
      ],
      currentSpeaker: { device: { deviceId: 'builtin-speaker-id', label: 'MacBook Pro Speakers' } },
    },
  },
};

test.describe('Device Error Recovery — Speaker output (Issue #1190)', () => {
  /**
   * DEVRECOV-015: Preferred speaker not in device list shows speaker device picker
   *
   * When the preferred speaker (e.g. monitor) is unplugged and the OS auto-switches
   * to the built-in speakers, alignSpeaker() detects a fallback match and shows
   * a device picker — not silently switches.
   *
   * Root cause: unlike camera/mic (which have Daily error events), speaker disconnect
   * is only detectable via device alignment. When the OS auto-routes to built-in
   * speakers, currentSpeaker === fallback target — the "skip if already using" check
   * was preventing the picker from ever showing.
   *
   * Fix: check for fallback BEFORE the skip guard.
   */
  test('DEVRECOV-015: speaker not found shows speaker device picker', async ({ mount, page }) => {
    // Mock enumerateDevices to return an audiooutput device for the picker
    await page.evaluate(() => {
      navigator.mediaDevices.enumerateDevices = async () => [
        { kind: 'audioinput', label: 'Built-in Microphone', deviceId: 'mic-builtin-id' },
        { kind: 'audiooutput', label: 'MacBook Pro Speakers', deviceId: 'builtin-speaker-id' },
      ];
    });

    const component = await mount(<VideoCall showSelfView />, { hooksConfig: configWithMissingSpeaker });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Device picker modal should appear because preferred speaker is unavailable
    await expect(page.getByRole('heading', { name: 'Speakers not available' })).toBeVisible({ timeout: 8000 });

    // Speaker picker dropdown should be shown
    await expect(page.locator('[data-test="devicePickerSelect"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-test="switchDeviceButton"]')).toBeVisible();

    // Generic steps should NOT appear when picker is shown
    await expect(page.locator('text=Reload the page to retry')).not.toBeVisible();
  });

  /**
   * DEVRECOV-016: Selecting a speaker from the picker calls setSpeaker and clears error
   *
   * When the user picks a replacement speaker from the dropdown and clicks
   * "Switch to this device", VideoCall should call devices.setSpeaker() with
   * the chosen device ID and dismiss the modal.
   */
  test('DEVRECOV-016: selecting speaker from picker calls setSpeaker and clears error', async ({ mount, page }) => {
    // Set up spy and enumerateDevices mock together in a single evaluate to avoid
    // webkit-specific issues with multiple evaluate calls resetting each other.
    await page.evaluate(() => {
      window._setSpeakerCalls = [];
      window.mockDailyDeviceOverrides = {
        setSpeaker: (id) => {
          window._setSpeakerCalls.push(id);
          return Promise.resolve();
        },
      };
      navigator.mediaDevices.enumerateDevices = async () => [
        { kind: 'audioinput', label: 'Built-in Microphone', deviceId: 'mic-builtin-id' },
        { kind: 'audiooutput', label: 'MacBook Pro Speakers', deviceId: 'builtin-speaker-id' },
      ];
    });

    const component = await mount(<VideoCall showSelfView />, { hooksConfig: configWithMissingSpeaker });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Wait for picker to appear
    await expect(page.locator('[data-test="devicePickerSelect"]')).toBeVisible({ timeout: 8000 });

    // Click switch button
    await page.locator('[data-test="switchDeviceButton"]').dispatchEvent('click');

    // setSpeaker should have been called with the selected device ID
    const calls = await page.evaluate(() => window._setSpeakerCalls);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1]).not.toBeUndefined();

    // Error modal should be dismissed
    await expect(page.getByRole('heading', { name: 'Speakers not available' })).not.toBeVisible({ timeout: 5000 });
  });
});
