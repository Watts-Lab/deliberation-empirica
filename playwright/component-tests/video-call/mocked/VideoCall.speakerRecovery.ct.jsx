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
/**
 * Config that simulates a monitor with a camera AND speakers being unplugged:
 * - Player's preferred camera = monitor camera (not in devices.cameras)
 * - Player's preferred speaker = monitor speaker (not in devices.speakers)
 * - Current camera (OS auto-switched) = built-in camera
 * - Current speaker (OS auto-switched) = built-in speaker
 *
 * Both alignCamera() and alignSpeaker() fire fallback errors simultaneously.
 * The merge logic must NOT merge camera-error + speaker-error — they have
 * different picker semantics and the camera error should show first.
 */
const configWithMissingCameraAndSpeaker = {
  empirica: {
    currentPlayerId: 'p0',
    players: [{
      id: 'p0',
      attrs: {
        name: 'Test User',
        position: '0',
        dailyId: 'daily-p0',
        cameraId: 'monitor-camera-id',
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
      cameras: [
        { device: { deviceId: 'builtin-camera-id', label: 'FaceTime HD Camera' } },
      ],
      currentCam: { device: { deviceId: 'builtin-camera-id', label: 'FaceTime HD Camera' } },
      speakers: [
        { device: { deviceId: 'builtin-speaker-id', label: 'MacBook Pro Speakers' } },
      ],
      currentSpeaker: { device: { deviceId: 'builtin-speaker-id', label: 'MacBook Pro Speakers' } },
    },
  },
};

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

/**
 * Config that simulates a USB headset (mic + speakers) being unplugged:
 * - Player's preferred mic = webcam mic (not in devices.microphones)
 * - Player's preferred speaker = monitor speaker (not in devices.speakers)
 * - Current mic (OS auto-switched) = built-in mic
 * - Current speaker (OS auto-switched) = built-in speaker
 *
 * Both alignMic() and alignSpeaker() fire fallback errors simultaneously.
 * Mic error shows first (higher priority), speaker surfaces after mic is resolved.
 * No cameraId is set so alignCamera() does not fire a camera picker.
 */
const configWithMissingMicAndSpeaker = {
  empirica: {
    currentPlayerId: 'p0',
    players: [{
      id: 'p0',
      attrs: {
        name: 'Test User',
        position: '0',
        dailyId: 'daily-p0',
        micId: 'webcam-mic-id',
        micLabel: 'Logitech HD Webcam Mic',
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
      microphones: [
        { device: { deviceId: 'builtin-mic-id', label: 'MacBook Pro Microphone' } },
      ],
      currentMic: { device: { deviceId: 'builtin-mic-id', label: 'MacBook Pro Microphone' } },
      speakers: [
        { device: { deviceId: 'builtin-speaker-id', label: 'MacBook Pro Speakers' } },
      ],
      currentSpeaker: { device: { deviceId: 'builtin-speaker-id', label: 'MacBook Pro Speakers' } },
    },
  },
};

/**
 * Config that simulates a monitor with a camera, speakers AND a webcam mic all being unplugged:
 * - Player's preferred camera = monitor camera (not in devices.cameras)
 * - Player's preferred mic = webcam mic (not in devices.microphones)
 * - Player's preferred speaker = monitor speaker (not in devices.speakers)
 * - All current devices (OS auto-switched) = built-in equivalents
 *
 * All three align*() functions fire fallback errors simultaneously.
 * Sequential order: camera → mic → speaker.
 */
const configWithAllDevicesMissing = {
  empirica: {
    currentPlayerId: 'p0',
    players: [{
      id: 'p0',
      attrs: {
        name: 'Test User',
        position: '0',
        dailyId: 'daily-p0',
        cameraId: 'monitor-camera-id',
        micId: 'webcam-mic-id',
        micLabel: 'Logitech HD Webcam Mic',
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
      cameras: [
        { device: { deviceId: 'builtin-camera-id', label: 'FaceTime HD Camera' } },
      ],
      currentCam: { device: { deviceId: 'builtin-camera-id', label: 'FaceTime HD Camera' } },
      microphones: [
        { device: { deviceId: 'builtin-mic-id', label: 'MacBook Pro Microphone' } },
      ],
      currentMic: { device: { deviceId: 'builtin-mic-id', label: 'MacBook Pro Microphone' } },
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
   * DEVRECOV-019: Camera + speaker both missing — camera picker shows first, not a
   *               merged "microphone" picker listing speaker devices.
   *
   * Root cause: the setDeviceError merge logic was checking only that two errors had
   * the same dailyErrorType and different type — but camera-error + speaker-error
   * both have dailyErrorType "not-found" and different types, so they merged into
   * { type: null, pickerDevices: [speakers] }. The merged error used "microphone"
   * copy (type=null falls through to "microphone" in pickerDeviceType) and showed
   * speaker devices in the mic picker. Clicking "Switch to this device" then called
   * setInputDevicesAsync({ audioDeviceId: speakerDeviceId }) which threw, leaving
   * the modal open.
   *
   * Fix: merge only applies to camera-error + mic-error pairs. Speaker-error is
   * excluded from merging and has lower type priority than camera/mic.
   */
  test('DEVRECOV-019: camera + speaker both missing shows camera picker (not merged microphone+speaker picker)', async ({ mount, page }) => {
    await page.evaluate(() => {
      navigator.mediaDevices.enumerateDevices = async () => [
        { kind: 'videoinput', label: 'FaceTime HD Camera', deviceId: 'builtin-camera-id' },
        { kind: 'audioinput', label: 'Built-in Microphone', deviceId: 'mic-builtin-id' },
        { kind: 'audiooutput', label: 'MacBook Pro Speakers', deviceId: 'builtin-speaker-id' },
      ];
    });

    const component = await mount(<VideoCall showSelfView />, { hooksConfig: configWithMissingCameraAndSpeaker });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Should show the CAMERA picker (not a merged "microphone" picker)
    await expect(page.getByRole('heading', { name: 'Camera not available' })).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-test="devicePickerSelect"]')).toBeVisible();

    // The picker must NOT be showing speaker devices under a "microphone" label
    await expect(page.locator('text=Your selected microphone isn\'t available')).not.toBeVisible();
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

  /**
   * DEVRECOV-020: Mic + speaker both missing — mic picker shows first, then speaker
   *
   * When a USB headset (providing both mic and speakers) is unplugged, the OS
   * auto-switches both to built-in devices. alignMic() and alignSpeaker() both
   * fire fallback errors simultaneously. The sequential display shows the mic
   * picker first (mic has priority over speaker). After the user selects a
   * replacement mic, the speaker picker surfaces.
   *
   * No cameraId set, so alignCamera() does not fire a camera picker.
   */
  test('DEVRECOV-020: mic + speaker both missing shows mic picker first, then speaker after switching', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: configWithMissingMicAndSpeaker });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Mic picker should appear first (higher priority than speaker)
    await expect(page.getByRole('heading', { name: 'Microphone not available' })).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-test="devicePickerSelect"]')).toBeVisible({ timeout: 5000 });

    // Speaker error should NOT be surfaced yet
    await expect(page.getByRole('heading', { name: 'Speakers not available' })).not.toBeVisible();

    // Switch the mic — clears micError, surfacing speakerError
    await page.locator('[data-test="switchDeviceButton"]').dispatchEvent('click');

    // Speaker picker should now appear
    await expect(page.getByRole('heading', { name: 'Speakers not available' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-test="devicePickerSelect"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Microphone not available' })).not.toBeVisible();
  });

  /**
   * WF4-004: When speaker "not-found" error is showing and the preferred speaker
   * is plugged back in (devicechange event fires), the component should
   * automatically call devices.setSpeaker() with the newly available speaker
   * device ID and dismiss the error modal.
   *
   * This is the speaker equivalent of WF4-001 (camera) and WF4-002 (mic).
   * The W4 handler was extended (Fix 2 of Issue #1190) to cover speaker-error
   * in addition to camera-error and mic-error.
   *
   * This test lives in the speaker file (not VideoCall.recoveryWorkflows) because
   * it needs enumerateDevices to return audiooutput devices, which would conflict
   * with camera/mic picker tests in webkit's fullyParallel mode.
   */
  test('WF4-004: devicechange during speaker error auto-recovers', async ({ mount, page }) => {
    // Set up setSpeaker spy before mount so it's available at call-time
    await page.evaluate(() => {
      window._setSpeakerCalls = [];
      window.mockDailyDeviceOverrides = {
        setSpeaker: (id) => {
          window._setSpeakerCalls.push(id);
          return Promise.resolve();
        },
      };
    });

    const component = await mount(<VideoCall showSelfView />, { hooksConfig: configWithMissingSpeaker });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Speaker picker should show (alignment detects preferred speaker unavailable)
    await expect(page.getByRole('heading', { name: 'Speakers not available' })).toBeVisible({ timeout: 8000 });

    // NOW set up enumerateDevices and fire devicechange — same timing as WF4-001/002
    // (setting enumerateDevices after picker appears avoids any webkit mock reset issues
    // that can happen when the override is set before mount and then overwritten by
    // UserMediaError's recordError effect running enumerateDevices during its setup)
    await page.evaluate(() => {
      window._mockDevices = [
        { kind: 'audiooutput', label: 'DELL U3415W Audio', deviceId: 'monitor-speaker-id', groupId: 'g1' },
      ];
      navigator.mediaDevices.enumerateDevices = async () => window._mockDevices;
      navigator.mediaDevices.dispatchEvent(new Event('devicechange'));
    });

    // Error should auto-clear: W4 handler detected the speaker and called setSpeaker
    await expect(page.getByRole('heading', { name: 'Speakers not available' })).not.toBeVisible({ timeout: 8000 });

    // Verify setSpeaker was called with the reconnected speaker's device ID
    const calls = await page.evaluate(() => window._setSpeakerCalls);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1]).toBe('monitor-speaker-id');
  });

  /**
   * DEVRECOV-021: Camera + mic + speaker all missing — pickers show in sequence
   *
   * When a monitor (with camera + speakers) AND a webcam mic are all unplugged,
   * all three align*() functions fire fallback errors simultaneously.
   * Sequential display: camera first (most critical), then mic, then speaker.
   * Each step is resolved independently via the device picker.
   */
  test('DEVRECOV-021: camera + mic + speaker all missing shows pickers in sequence: camera → mic → speaker', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: configWithAllDevicesMissing });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Camera picker shows first
    await expect(page.getByRole('heading', { name: 'Camera not available' })).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-test="devicePickerSelect"]')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Microphone not available' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Speakers not available' })).not.toBeVisible();

    // Switch camera → mic picker surfaces
    await page.locator('[data-test="switchDeviceButton"]').dispatchEvent('click');
    await expect(page.getByRole('heading', { name: 'Microphone not available' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Camera not available' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Speakers not available' })).not.toBeVisible();

    // Switch mic → speaker picker surfaces
    await page.locator('[data-test="switchDeviceButton"]').dispatchEvent('click');
    await expect(page.getByRole('heading', { name: 'Speakers not available' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Microphone not available' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Camera not available' })).not.toBeVisible();
  });
});
