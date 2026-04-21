import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { VideoCall } from "../../../../client/src/components/discussion/call/VideoCall";

/**
 * Component Tests for Speaker/Output Device Recovery
 *
 * Unlike camera and microphone (where Daily fires camera-error/mic-error events),
 * speaker disconnection fires NO Daily event. The OS silently routes audio to the
 * next available device, and only the device alignment effect can detect the change.
 *
 * When a device is not found (disconnected), the system auto-switches to a fallback
 * device and shows a non-modal banner (data-testid="deviceFallbackBanner") instead of
 * a blocking modal picker. Banners are non-blocking — call tiles remain visible
 * underneath. Multiple banners can stack when multiple devices are missing. Banners
 * auto-dismiss after 10s and have a dismiss button (data-testid="bannerDismiss").
 *
 * These tests are in a separate file from VideoCall.deviceRecovery.ct.jsx because
 * speaker recovery tests need enumerateDevices to return audiooutput devices, while
 * camera/mic tests mock it without audiooutput. Running in the same file
 * with fullyParallel:true causes webkit to have the mocks overwrite each other.
 */

/**
 * Config that simulates a monitor speaker that has been unplugged:
 * - Player's preferred speaker = monitor (not in devices.speakers)
 * - Current speaker (auto-switched by OS) = built-in
 * - devices.speakers = [built-in only]
 *
 * The device alignment effect fires because currentSpeaker !== preferredSpeaker.
 * alignSpeaker() finds no ID/label match → fallback → should show banner.
 */
/**
 * Config that simulates a monitor with a camera AND speakers being unplugged:
 * - Player's preferred camera = monitor camera (not in devices.cameras)
 * - Player's preferred speaker = monitor speaker (not in devices.speakers)
 * - Current camera (OS auto-switched) = built-in camera
 * - Current speaker (OS auto-switched) = built-in speaker
 *
 * Both alignCamera() and alignSpeaker() fire fallback errors simultaneously.
 * Both show non-modal banners that can stack — no sequential picker flow needed.
 */
const configWithMissingCameraAndSpeaker = {
  empirica: {
    currentPlayerId: "p0",
    players: [
      {
        id: "p0",
        attrs: {
          name: "Test User",
          position: "0",
          dailyId: "daily-p0",
          cameraId: "monitor-camera-id",
          speakerId: "monitor-speaker-id",
          speakerLabel: "DELL U3415W Audio",
        },
      },
    ],
    game: { attrs: { dailyUrl: "https://test.daily.co/room" } },
    stage: { attrs: {} },
    stageTimer: { elapsed: 0 },
  },
  daily: {
    localSessionId: "daily-p0",
    participantIds: ["daily-p0"],
    videoTracks: { "daily-p0": { isOff: false, subscribed: true } },
    audioTracks: { "daily-p0": { isOff: false, subscribed: true } },
    devices: {
      cameras: [
        {
          device: {
            deviceId: "builtin-camera-id",
            label: "FaceTime HD Camera",
          },
        },
      ],
      currentCam: {
        device: { deviceId: "builtin-camera-id", label: "FaceTime HD Camera" },
      },
      speakers: [
        {
          device: {
            deviceId: "builtin-speaker-id",
            label: "MacBook Pro Speakers",
          },
        },
      ],
      currentSpeaker: {
        device: {
          deviceId: "builtin-speaker-id",
          label: "MacBook Pro Speakers",
        },
      },
    },
  },
};

const configWithMissingSpeaker = {
  empirica: {
    currentPlayerId: "p0",
    players: [
      {
        id: "p0",
        attrs: {
          name: "Test User",
          position: "0",
          dailyId: "daily-p0",
          speakerId: "monitor-speaker-id",
          speakerLabel: "DELL U3415W Audio",
        },
      },
    ],
    game: { attrs: { dailyUrl: "https://test.daily.co/room" } },
    stage: { attrs: {} },
    stageTimer: { elapsed: 0 },
  },
  daily: {
    localSessionId: "daily-p0",
    participantIds: ["daily-p0"],
    videoTracks: { "daily-p0": { isOff: false, subscribed: true } },
    audioTracks: { "daily-p0": { isOff: false, subscribed: true } },
    devices: {
      speakers: [
        {
          device: {
            deviceId: "builtin-speaker-id",
            label: "MacBook Pro Speakers",
          },
        },
      ],
      currentSpeaker: {
        device: {
          deviceId: "builtin-speaker-id",
          label: "MacBook Pro Speakers",
        },
      },
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
 * Both show non-modal banners that stack — no sequential picker flow needed.
 * No cameraId is set so alignCamera() does not fire a banner.
 */
const configWithMissingMicAndSpeaker = {
  empirica: {
    currentPlayerId: "p0",
    players: [
      {
        id: "p0",
        attrs: {
          name: "Test User",
          position: "0",
          dailyId: "daily-p0",
          micId: "webcam-mic-id",
          micLabel: "Logitech HD Webcam Mic",
          speakerId: "monitor-speaker-id",
          speakerLabel: "DELL U3415W Audio",
        },
      },
    ],
    game: { attrs: { dailyUrl: "https://test.daily.co/room" } },
    stage: { attrs: {} },
    stageTimer: { elapsed: 0 },
  },
  daily: {
    localSessionId: "daily-p0",
    participantIds: ["daily-p0"],
    videoTracks: { "daily-p0": { isOff: false, subscribed: true } },
    audioTracks: { "daily-p0": { isOff: false, subscribed: true } },
    devices: {
      microphones: [
        {
          device: {
            deviceId: "builtin-mic-id",
            label: "MacBook Pro Microphone",
          },
        },
      ],
      currentMic: {
        device: { deviceId: "builtin-mic-id", label: "MacBook Pro Microphone" },
      },
      speakers: [
        {
          device: {
            deviceId: "builtin-speaker-id",
            label: "MacBook Pro Speakers",
          },
        },
      ],
      currentSpeaker: {
        device: {
          deviceId: "builtin-speaker-id",
          label: "MacBook Pro Speakers",
        },
      },
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
 * All show non-modal banners that stack — no sequential picker flow needed.
 */
const configWithAllDevicesMissing = {
  empirica: {
    currentPlayerId: "p0",
    players: [
      {
        id: "p0",
        attrs: {
          name: "Test User",
          position: "0",
          dailyId: "daily-p0",
          cameraId: "monitor-camera-id",
          micId: "webcam-mic-id",
          micLabel: "Logitech HD Webcam Mic",
          speakerId: "monitor-speaker-id",
          speakerLabel: "DELL U3415W Audio",
        },
      },
    ],
    game: { attrs: { dailyUrl: "https://test.daily.co/room" } },
    stage: { attrs: {} },
    stageTimer: { elapsed: 0 },
  },
  daily: {
    localSessionId: "daily-p0",
    participantIds: ["daily-p0"],
    videoTracks: { "daily-p0": { isOff: false, subscribed: true } },
    audioTracks: { "daily-p0": { isOff: false, subscribed: true } },
    devices: {
      cameras: [
        {
          device: {
            deviceId: "builtin-camera-id",
            label: "FaceTime HD Camera",
          },
        },
      ],
      currentCam: {
        device: { deviceId: "builtin-camera-id", label: "FaceTime HD Camera" },
      },
      microphones: [
        {
          device: {
            deviceId: "builtin-mic-id",
            label: "MacBook Pro Microphone",
          },
        },
      ],
      currentMic: {
        device: { deviceId: "builtin-mic-id", label: "MacBook Pro Microphone" },
      },
      speakers: [
        {
          device: {
            deviceId: "builtin-speaker-id",
            label: "MacBook Pro Speakers",
          },
        },
      ],
      currentSpeaker: {
        device: {
          deviceId: "builtin-speaker-id",
          label: "MacBook Pro Speakers",
        },
      },
    },
  },
};

test.describe("Device Error Recovery — Speaker output (Issue #1190)", () => {
  /**
   * DEVRECOV-015: Preferred speaker not in device list shows fallback banner
   *
   * When the preferred speaker (e.g. monitor) is unplugged and the OS auto-switches
   * to the built-in speakers, alignSpeaker() detects a fallback match, auto-switches
   * to the fallback device via setSpeaker(), and shows a non-modal banner informing
   * the user — instead of a blocking modal picker.
   *
   * The banner is non-blocking: call tiles remain visible underneath.
   */
  test("DEVRECOV-015: speaker not found shows fallback banner (not modal picker)", async ({
    mount,
    page,
  }) => {
    // Set up setSpeaker spy and enumerateDevices mock
    await page.evaluate(() => {
      window._setSpeakerCalls = [];
      window.mockDailyDeviceOverrides = {
        setSpeaker: (id) => {
          window._setSpeakerCalls.push(id);
          return Promise.resolve();
        },
      };
      navigator.mediaDevices.enumerateDevices = async () => [
        {
          kind: "audioinput",
          label: "Built-in Microphone",
          deviceId: "mic-builtin-id",
        },
        {
          kind: "audiooutput",
          label: "MacBook Pro Speakers",
          deviceId: "builtin-speaker-id",
        },
      ];
    });

    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: configWithMissingSpeaker,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Non-modal banner should appear for speaker fallback
    const speakerBanner = page.locator(
      '[data-testid="deviceFallbackBanner"][data-device-type="speaker"]'
    );
    await expect(speakerBanner).toBeVisible({ timeout: 8000 });

    // Banner text should mention disconnection or switching
    const bannerText = await speakerBanner.textContent();
    expect(bannerText).toMatch(/disconnect|switch/i);

    // NO modal heading or picker should appear
    await expect(
      page.getByRole("heading", { name: "Speakers not available" })
    ).not.toBeVisible();
    await expect(
      page.locator('[data-testid="devicePickerSelect"]')
    ).not.toBeVisible();

    // Call tiles should still be visible (non-blocking banner)
    await expect(
      page.locator('[data-testid="callTile"]').first()
    ).toBeVisible();

    // setSpeaker should have been called (auto-switch to fallback)
    const calls = await page.evaluate(() => window._setSpeakerCalls);
    expect(calls.length).toBeGreaterThan(0);
  });

  /**
   * DEVRECOV-019: Camera + speaker both missing — both show non-modal banners
   *
   * When a monitor (with camera + speakers) is unplugged, both alignCamera() and
   * alignSpeaker() fire fallback errors simultaneously. Both show non-modal banners
   * that stack — no sequential picker flow is needed. Call tiles remain visible.
   */
  test("DEVRECOV-019: camera + speaker both missing shows two stacked banners", async ({
    mount,
    page,
  }) => {
    await page.evaluate(() => {
      navigator.mediaDevices.enumerateDevices = async () => [
        {
          kind: "videoinput",
          label: "FaceTime HD Camera",
          deviceId: "builtin-camera-id",
        },
        {
          kind: "audioinput",
          label: "Built-in Microphone",
          deviceId: "mic-builtin-id",
        },
        {
          kind: "audiooutput",
          label: "MacBook Pro Speakers",
          deviceId: "builtin-speaker-id",
        },
      ];
    });

    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: configWithMissingCameraAndSpeaker,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Both banners should be visible simultaneously (non-modal, stacked)
    const cameraBanner = page.locator(
      '[data-testid="deviceFallbackBanner"][data-device-type="camera"]'
    );
    const speakerBanner = page.locator(
      '[data-testid="deviceFallbackBanner"][data-device-type="speaker"]'
    );
    await expect(cameraBanner).toBeVisible({ timeout: 8000 });
    await expect(speakerBanner).toBeVisible({ timeout: 8000 });

    // NO modal headings should appear
    await expect(
      page.getByRole("heading", { name: "Camera not available" })
    ).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Speakers not available" })
    ).not.toBeVisible();

    // Call tiles should still be visible (non-blocking)
    await expect(
      page.locator('[data-testid="callTile"]').first()
    ).toBeVisible();
  });

  /**
   * DEVRECOV-016: Speaker fallback auto-switches and banner can be dismissed
   *
   * When the preferred speaker is not found, the system auto-switches to the
   * fallback device via setSpeaker() and shows a non-modal banner. The banner
   * can be dismissed by clicking the dismiss button.
   */
  test("DEVRECOV-016: speaker fallback auto-switches and banner can be dismissed", async ({
    mount,
    page,
  }) => {
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
        {
          kind: "audioinput",
          label: "Built-in Microphone",
          deviceId: "mic-builtin-id",
        },
        {
          kind: "audiooutput",
          label: "MacBook Pro Speakers",
          deviceId: "builtin-speaker-id",
        },
      ];
    });

    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: configWithMissingSpeaker,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Banner should appear (not a modal picker)
    const speakerBanner = page.locator(
      '[data-testid="deviceFallbackBanner"][data-device-type="speaker"]'
    );
    await expect(speakerBanner).toBeVisible({ timeout: 8000 });

    // setSpeaker should have been called with a device ID (auto-switched)
    const calls = await page.evaluate(() => window._setSpeakerCalls);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1]).not.toBeUndefined();

    // Dismiss the banner
    await page.locator('[data-testid="bannerDismiss"]').click();

    // Banner should be gone after dismissal
    await expect(speakerBanner).not.toBeVisible({ timeout: 5000 });
  });

  /**
   * DEVRECOV-020: Mic + speaker both missing — both show non-modal banners
   *
   * When a USB headset (providing both mic and speakers) is unplugged, the OS
   * auto-switches both to built-in devices. alignMic() and alignSpeaker() both
   * fire fallback errors simultaneously. Both show non-modal banners that stack.
   *
   * No cameraId set, so alignCamera() does not fire a banner.
   */
  test("DEVRECOV-020: mic + speaker both missing shows two stacked banners", async ({
    mount,
    page,
  }) => {
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: configWithMissingMicAndSpeaker,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Both banners should be visible simultaneously (non-modal, stacked)
    const micBanner = page.locator(
      '[data-testid="deviceFallbackBanner"][data-device-type="microphone"]'
    );
    const speakerBanner = page.locator(
      '[data-testid="deviceFallbackBanner"][data-device-type="speaker"]'
    );
    await expect(micBanner).toBeVisible({ timeout: 8000 });
    await expect(speakerBanner).toBeVisible({ timeout: 8000 });

    // NO modal headings should appear
    await expect(
      page.getByRole("heading", { name: "Microphone not available" })
    ).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Speakers not available" })
    ).not.toBeVisible();
  });

  /**
   * WF4-004: When speaker fallback banner is showing and the preferred speaker
   * is plugged back in (devicechange event fires), the banner should auto-clear.
   *
   * This is the speaker equivalent of WF4-001 (camera) and WF4-002 (mic).
   * The recovery handler detects the preferred speaker is available again and
   * clears the banner. Alignment will re-run and switch back to the preferred device.
   *
   * This test lives in the speaker file (not VideoCall.recoveryWorkflows) because
   * it needs enumerateDevices to return audiooutput devices, which would conflict
   * with camera/mic tests in webkit's fullyParallel mode.
   */
  test("WF4-004: devicechange during speaker fallback banner auto-recovers", async ({
    mount,
    page,
  }) => {
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

    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: configWithMissingSpeaker,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Banner should appear (not a modal heading)
    const speakerBanner = page.locator(
      '[data-testid="deviceFallbackBanner"][data-device-type="speaker"]'
    );
    await expect(speakerBanner).toBeVisible({ timeout: 8000 });

    // NOW set up enumerateDevices with the preferred speaker and fire devicechange
    // (setting enumerateDevices after banner appears avoids any webkit mock reset issues
    // that can happen when the override is set before mount and then overwritten by
    // UserMediaError's recordError effect running enumerateDevices during its setup)
    await page.evaluate(() => {
      window._mockDevices = [
        {
          kind: "audiooutput",
          label: "DELL U3415W Audio",
          deviceId: "monitor-speaker-id",
          groupId: "g1",
        },
      ];
      navigator.mediaDevices.enumerateDevices = async () => window._mockDevices;
      navigator.mediaDevices.dispatchEvent(new Event("devicechange"));
    });

    // Banner should auto-clear: recovery handler detected the preferred speaker
    await expect(speakerBanner).not.toBeVisible({ timeout: 8000 });
  });

  /**
   * DEVRECOV-021: Camera + mic + speaker all missing — all show stacked banners
   *
   * When a monitor (with camera + speakers) AND a webcam mic are all unplugged,
   * all three align*() functions fire fallback errors simultaneously.
   * All show non-modal banners that stack — no sequential picker flow needed.
   */
  test("DEVRECOV-021: camera + mic + speaker all missing shows three stacked banners", async ({
    mount,
    page,
  }) => {
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: configWithAllDevicesMissing,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // All three banners should be visible simultaneously (non-modal, stacked)
    const cameraBanner = page.locator(
      '[data-testid="deviceFallbackBanner"][data-device-type="camera"]'
    );
    const micBanner = page.locator(
      '[data-testid="deviceFallbackBanner"][data-device-type="microphone"]'
    );
    const speakerBanner = page.locator(
      '[data-testid="deviceFallbackBanner"][data-device-type="speaker"]'
    );
    await expect(cameraBanner).toBeVisible({ timeout: 8000 });
    await expect(micBanner).toBeVisible({ timeout: 8000 });
    await expect(speakerBanner).toBeVisible({ timeout: 8000 });

    // NO modal headings should appear
    await expect(
      page.getByRole("heading", { name: "Camera not available" })
    ).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Microphone not available" })
    ).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Speakers not available" })
    ).not.toBeVisible();
  });
});
