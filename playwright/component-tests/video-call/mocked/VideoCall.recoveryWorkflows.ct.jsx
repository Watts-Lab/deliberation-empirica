import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../../../client/src/call/VideoCall';

/**
 * Recovery Workflow Tests (RED/GREEN TDD)
 *
 * These tests cover gaps identified in RECOVERY-PLAYBOOK.md — recovery
 * workflows that are specified but not yet implemented. Each test is written
 * RED first (expected to fail against current code), then production code
 * is added to make them GREEN.
 *
 * Organized by workflow:
 * - W5: Fatal `error` event handling (connection lost, ejected, expired)
 * - W6: Network interruption banner (`network-connection` event)
 * - Sentry on Fix A/V submission (reported issues included in payload)
 * - W1: Permission revocation proactive UI
 * - W4: Device reconnected auto-recovery (ondevicechange)
 * - W2: Auto-fix before showing device picker (not-found error)
 * - W7: Proactive track monitoring (ended track detection)
 */

const connectedConfig = {
  empirica: {
    currentPlayerId: 'p0',
    players: [{ id: 'p0', attrs: { name: 'Test User', position: '0', dailyId: 'daily-p0' } }],
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

/**
 * Install a controllable permissions mock before mounting.
 * Reusable helper adapted from PermissionMonitoring.ct.jsx.
 */
async function installPermissionsMock(page, initialCamState = 'granted', initialMicState = 'granted') {
  await page.evaluate(({ cam, mic }) => {
    const makePerm = (initialState) => {
      const perm = { state: initialState, _onchange: null };
      Object.defineProperty(perm, 'onchange', {
        get() { return this._onchange; },
        set(fn) { this._onchange = fn; },
        configurable: true,
      });
      return perm;
    };

    const camPerm = makePerm(cam);
    const micPerm = makePerm(mic);

    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      get: () => ({
        query: async ({ name }) => (name === 'camera' ? camPerm : micPerm),
      }),
    });

    window.mockCamPerm = camPerm;
    window.mockMicPerm = micPerm;
    window.triggerPermChange = (type, newState) => {
      const perm = type === 'camera' ? camPerm : micPerm;
      perm.state = newState;
      if (perm._onchange) perm._onchange(new Event('change'));
    };
  }, { cam: initialCamState, mic: initialMicState });
}

// ---------------------------------------------------------------------------
// W5: Fatal error recovery
// ---------------------------------------------------------------------------
// Daily's `error` event fires when the call is unrecoverably dead. Currently
// only logged to console (eventLogger.js:101). No UI, no recovery.
// ---------------------------------------------------------------------------

test.describe('W5: Fatal error recovery', () => {
  /**
   * WF5-001: When Daily fires a fatal `error` event with type `connection-error`,
   * the UI should show "Connection lost" with a Rejoin button.
   */
  test('WF5-001: connection-error shows Connection lost message', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      window.mockCallObject.emit('error', {
        type: 'connection-error',
        msg: 'Network connection failed',
        error: { type: 'connection-error', msg: 'Network connection failed' },
      });
    });

    await expect(page.locator('text=Connection lost')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-test="rejoinCall"]')).toBeVisible();
  });

  /**
   * WF5-002: When Daily fires `error` with type `ejected`, show "removed"
   * message with NO rejoin button (ejection is intentional by moderator).
   */
  test('WF5-002: ejected shows removed message without rejoin', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      window.mockCallObject.emit('error', {
        type: 'ejected',
        msg: 'You have been removed',
        error: { type: 'ejected', msg: 'You have been removed' },
      });
    });

    await expect(page.getByRole('heading', { name: /removed/i })).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-test="rejoinCall"]')).not.toBeVisible();
  });

  /**
   * WF5-003: When Daily fires `error` with type `exp-room`, show "expired".
   */
  test('WF5-003: exp-room shows session expired', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      window.mockCallObject.emit('error', {
        type: 'exp-room',
        msg: 'Room expired',
        error: { type: 'exp-room', msg: 'Room expired' },
      });
    });

    await expect(page.getByRole('heading', { name: /expired/i })).toBeVisible({ timeout: 8000 });
  });

  /**
   * WF5-004: Clicking the Rejoin button should call callObject.join() to
   * re-establish the connection.
   */
  test('WF5-004: rejoin button triggers callObject.join()', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      window.mockCallObject.emit('error', {
        type: 'connection-error',
        msg: 'Lost',
        error: { type: 'connection-error', msg: 'Lost' },
      });
    });

    await expect(page.locator('[data-test="rejoinCall"]')).toBeVisible({ timeout: 8000 });
    await page.locator('[data-test="rejoinCall"]').click();

    // Mock's join() should have been called
    const joinCalled = await page.evaluate(() => window.mockCallObject._joinCalled);
    expect(joinCalled).toBeTruthy();
  });

  /**
   * WF5-005: Fatal error should send a Sentry capture so we can track
   * connection failures in production.
   */
  test('WF5-005: fatal error sends Sentry capture', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => window.mockSentryCaptures.reset());

    await page.evaluate(() => {
      window.mockCallObject.emit('error', {
        type: 'connection-error',
        msg: 'Network failed',
        error: { type: 'connection-error', msg: 'Network failed' },
      });
    });

    await page.waitForTimeout(1000);
    const captures = await page.evaluate(() => window.mockSentryCaptures);
    const fatalMsg = captures.messages.find(
      (m) => /fatal|connection|daily.*error/i.test(m.message)
    );
    expect(fatalMsg).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// W6: Network interruption banner
// ---------------------------------------------------------------------------
// Daily fires `network-connection` with event:'interrupted'/'connected'.
// Currently not listened for. User sees frozen video with no explanation.
// ---------------------------------------------------------------------------

test.describe('W6: Network interruption banner', () => {
  /**
   * WF6-001: When network-connection fires with event:'interrupted',
   * show a "Reconnecting..." banner. Call tiles should remain visible
   * (this is a non-blocking banner, not a full overlay).
   */
  test('WF6-001: network interrupted shows reconnecting banner', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      window.mockCallObject.emit('network-connection', {
        type: 'signaling',
        event: 'interrupted',
      });
    });

    await expect(page.locator('text=/reconnecting/i')).toBeVisible({ timeout: 8000 });
    // Call tiles should still be visible underneath the banner
    await expect(page.locator('[data-test="callTile"]')).toBeVisible();
  });

  /**
   * WF6-002: When network-connection fires with event:'connected' after
   * an interruption, the banner should disappear.
   */
  test('WF6-002: network reconnected clears banner', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Interrupt
    await page.evaluate(() => {
      window.mockCallObject.emit('network-connection', {
        type: 'signaling',
        event: 'interrupted',
      });
    });
    await expect(page.locator('text=/reconnecting/i')).toBeVisible({ timeout: 8000 });

    // Reconnect
    await page.evaluate(() => {
      window.mockCallObject.emit('network-connection', {
        type: 'signaling',
        event: 'connected',
      });
    });
    await expect(page.locator('text=/reconnecting/i')).not.toBeVisible({ timeout: 5000 });
  });

  /**
   * WF6-003: Network interruption should log a Sentry breadcrumb for
   * post-incident debugging.
   */
  test('WF6-003: network interruption sends Sentry breadcrumb', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => window.mockSentryCaptures.reset());

    await page.evaluate(() => {
      window.mockCallObject.emit('network-connection', {
        type: 'signaling',
        event: 'interrupted',
      });
    });

    await page.waitForTimeout(1000);
    const captures = await page.evaluate(() => window.mockSentryCaptures);
    const breadcrumb = captures.breadcrumbs.find((b) => /network/i.test(b.category));
    expect(breadcrumb).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Sentry on Fix A/V submission
// ---------------------------------------------------------------------------
// We report to Sentry when the user SUBMITS the modal (not on button click).
// This way the reported issues and full diagnostic snapshot are included in
// the same event. A click-then-cancel is low signal; a submitted report is
// the meaningful event. See ERR-FixAV for the complementary Sentry tag check.
// ---------------------------------------------------------------------------

test.describe('Sentry on Fix A/V submission', () => {
  /**
   * WF-SENTRY-001: Submitting the Fix A/V modal sends reportedAVError to Sentry
   * with userReportedIssues in the extra payload. Clicking the button alone
   * (without submitting) must NOT send any Sentry message.
   */
  test('WF-SENTRY-001: Fix A/V submission sends Sentry with reported issues', async ({ mount, page }) => {
    test.slow();
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => window.mockSentryCaptures.reset());

    // Click Fix A/V button — modal opens, but no Sentry message yet
    await page.locator('[data-test="fixAV"]').click();
    await expect(
      page.locator('text=What problems are you experiencing?')
    ).toBeVisible({ timeout: 5000 });

    // No Sentry message should have been sent on click alone
    const capturesAfterClick = await page.evaluate(() => window.mockSentryCaptures);
    expect(capturesAfterClick.messages.length).toBe(0);

    // Select an issue and submit
    await page.locator("text=I can't hear other participants").click();
    await page.locator('button:has-text("Diagnose & Fix")').click();
    await expect(page.locator('text=Attempting to fix...')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Attempting to fix...')).not.toBeVisible({ timeout: 15000 });

    await page.waitForTimeout(500);

    const capturesAfterSubmit = await page.evaluate(() => window.mockSentryCaptures);
    const avMsg = capturesAfterSubmit.messages.find((m) => m.message === 'reportedAVError');
    expect(avMsg, 'Expected reportedAVError Sentry message after submission').toBeTruthy();
    // Reported issues must be present in the extra data
    expect(avMsg.hint.extra.userReportedIssues).toContain('cant-hear');
  });
});

// ---------------------------------------------------------------------------
// W1 mid-call: Permission revocation proactive UI
// ---------------------------------------------------------------------------
// When camera/mic permission is revoked mid-call, we currently only log to
// console. Users get no visual feedback until they click Fix A/V.
// ---------------------------------------------------------------------------

test.describe('W1: Permission revocation proactive UI', () => {
  /**
   * WF1-MID-001: When camera permission is revoked mid-call (via browser
   * settings), the PermissionDeniedGuidance overlay should appear
   * proactively — before the user has to click Fix A/V.
   */
  test('WF1-MID-001: camera permission revoked shows guidance', async ({ mount, page }) => {
    await installPermissionsMock(page, 'granted', 'granted');

    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Wait for permission onchange handlers to be installed
    await page.waitForFunction(
      () => !!window.mockCamPerm?._onchange,
      { timeout: 10000 }
    );

    // Revoke camera permission
    await page.evaluate(() => window.triggerPermChange('camera', 'denied'));

    // PermissionDeniedGuidance should appear proactively
    await expect(
      page.locator('text=/enable.*browser.*settings/i')
    ).toBeVisible({ timeout: 8000 });
  });

  /**
   * WF1-MID-002: When camera permission is re-granted after being revoked,
   * the page should auto-reload (clearing the guidance and re-acquiring devices).
   */
  test('WF1-MID-002: permission re-granted triggers auto-reload', async ({ mount, page }) => {
    await installPermissionsMock(page, 'granted', 'granted');

    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    await page.waitForFunction(
      () => !!window.mockCamPerm?._onchange,
      { timeout: 10000 }
    );

    // Revoke camera permission
    await page.evaluate(() => window.triggerPermChange('camera', 'denied'));
    await expect(
      page.locator('text=/enable.*browser.*settings/i')
    ).toBeVisible({ timeout: 8000 });

    // Intercept navigation to detect reload
    let reloadDetected = false;
    await page.route('**', async (route) => {
      if (
        route.request().isNavigationRequest() &&
        route.request().resourceType() === 'document'
      ) {
        reloadDetected = true;
        await route.abort();
      } else {
        await route.continue();
      }
    });

    // Re-grant permission — should trigger auto-reload
    await page.evaluate(() => window.triggerPermChange('camera', 'granted'));
    await page.waitForTimeout(3000);
    expect(reloadDetected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// W4: Device reconnected auto-recovery
// ---------------------------------------------------------------------------
// When a device is unplugged mid-call, Daily fires camera-error/mic-error with
// dailyErrorType "not-found". If the user plugs the device back in, the browser
// fires a `devicechange` event on navigator.mediaDevices. Currently nothing
// listens for this. User must manually use Fix A/V or reload.
//
// Expected: When a devicechange event fires while a device error is showing,
// automatically re-enumerate devices and attempt to re-acquire the device.
// ---------------------------------------------------------------------------

test.describe('W4: Device reconnected auto-recovery', () => {
  /**
   * WF4-001: When a camera "not-found" error is showing and a new device is
   * plugged in (devicechange event fires), the component should automatically
   * attempt to switch to the newly available camera and clear the error.
   */
  test('WF4-001: devicechange during camera error auto-recovers', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Mock enumerateDevices AFTER mount — initially empty (device unplugged)
    await page.evaluate(() => {
      window._mockDevices = [];
      navigator.mediaDevices.enumerateDevices = async () => window._mockDevices;
    });

    // Fire camera-error with not-found
    await page.evaluate(() => {
      window.mockCallObject.emit('camera-error', {
        errorMsg: 'Camera not found',
        error: { type: 'not-found', message: 'Device not found' },
      });
    });

    await expect(page.locator('text=Camera blocked')).toBeVisible({ timeout: 8000 });

    // Simulate plugging in a camera — update mock devices, fire devicechange
    await page.evaluate(() => {
      window._mockDevices = [
        { kind: 'videoinput', label: 'USB Camera', deviceId: 'usb-camera-id', groupId: 'g1' },
        { kind: 'audioinput', label: 'Built-in Mic', deviceId: 'mic-id', groupId: 'g2' },
      ];
      navigator.mediaDevices.dispatchEvent(new Event('devicechange'));
    });

    // Error should auto-clear because the component detected a new camera and
    // called setInputDevicesAsync to re-acquire it
    await expect(page.locator('text=Camera blocked')).not.toBeVisible({ timeout: 8000 });

    // Verify setInputDevicesAsync was called with the new camera
    const calls = await page.evaluate(() => window.mockCallObject._setInputDevicesCalls);
    const cameraSwitchCall = calls.find((c) => c.videoDeviceId === 'usb-camera-id');
    expect(cameraSwitchCall).toBeTruthy();
  });

  /**
   * WF4-002: Same as WF4-001 but for microphone not-found errors.
   * When mic error is showing and a new mic is plugged in, auto-recover.
   */
  test('WF4-002: devicechange during mic error auto-recovers', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Mock enumerateDevices AFTER mount — initially empty
    await page.evaluate(() => {
      window._mockDevices = [];
      navigator.mediaDevices.enumerateDevices = async () => window._mockDevices;
    });

    // Fire mic-error with not-found
    await page.evaluate(() => {
      window.mockCallObject.emit('mic-error', {
        errorMsg: 'Microphone not found',
        error: { type: 'not-found', message: 'Device not found' },
      });
    });

    await expect(page.locator('text=Microphone blocked')).toBeVisible({ timeout: 8000 });

    // Plug in a mic
    await page.evaluate(() => {
      window._mockDevices = [
        { kind: 'audioinput', label: 'USB Microphone', deviceId: 'usb-mic-id', groupId: 'g1' },
      ];
      navigator.mediaDevices.dispatchEvent(new Event('devicechange'));
    });

    // Error should auto-clear
    await expect(page.locator('text=Microphone blocked')).not.toBeVisible({ timeout: 8000 });

    // Verify setInputDevicesAsync was called with the new mic
    const calls = await page.evaluate(() => window.mockCallObject._setInputDevicesCalls);
    const micSwitchCall = calls.find((c) => c.audioDeviceId === 'usb-mic-id');
    expect(micSwitchCall).toBeTruthy();
  });

  /**
   * WF4-003: devicechange should NOT auto-recover if the error is NOT
   * "not-found" (e.g., "permissions" or "in-use" — plugging in a device
   * won't help with those).
   */
  test('WF4-003: devicechange ignored for non-not-found errors', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      navigator.mediaDevices.enumerateDevices = async () => [
        { kind: 'videoinput', label: 'Camera', deviceId: 'cam-id', groupId: 'g1' },
      ];
    });

    // Fire camera-error with permissions (not "not-found")
    await page.evaluate(() => {
      window.mockCallObject.emit('camera-error', {
        error: { type: 'permissions', message: 'Permission denied' },
      });
    });

    await expect(page.locator('text=Camera blocked')).toBeVisible({ timeout: 8000 });

    // Fire devicechange — should NOT clear permissions error
    await page.evaluate(() => {
      navigator.mediaDevices.dispatchEvent(new Event('devicechange'));
    });

    await page.waitForTimeout(2000);
    await expect(page.locator('text=Camera blocked')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// W2: Auto-fix before showing device picker
// ---------------------------------------------------------------------------
// When a "not-found" error fires and alternative devices are available, try
// switching to the first available device automatically before showing the
// picker UI. Only show the picker if auto-switch fails or there's ambiguity
// (multiple devices available).
// ---------------------------------------------------------------------------

test.describe('W2: Auto-fix before device picker', () => {
  /**
   * WF2-001: When camera not-found fires and exactly ONE other camera is
   * available, auto-switch to it without showing the device picker.
   */
  test('WF2-001: single alternative camera auto-switches silently', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Mock enumerateDevices AFTER mount to ensure it sticks in all browsers
    await page.evaluate(() => {
      navigator.mediaDevices.enumerateDevices = async () => [
        { kind: 'videoinput', label: 'Built-in Camera', deviceId: 'builtin-cam-id', groupId: 'g1' },
        { kind: 'audioinput', label: 'Built-in Mic', deviceId: 'mic-id', groupId: 'g2' },
      ];
    });

    // Fire camera-error with not-found
    await page.evaluate(() => {
      window.mockCallObject.emit('camera-error', {
        errorMsg: 'Camera not found',
        error: { type: 'not-found', message: 'Device not found' },
      });
    });

    // Should auto-switch — error should clear WITHOUT user interaction
    await expect(page.locator('text=Camera blocked')).not.toBeVisible({ timeout: 8000 });

    // Verify setInputDevicesAsync was called with the mocked camera
    const calls = await page.evaluate(() => window.mockCallObject._setInputDevicesCalls);
    const autoSwitch = calls.find((c) => c.videoDeviceId === 'builtin-cam-id');
    expect(autoSwitch).toBeTruthy();
  });

  /**
   * WF2-002: When mic not-found fires and exactly ONE other mic is available,
   * auto-switch to it without showing the device picker.
   */
  test('WF2-002: single alternative mic auto-switches silently', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Mock enumerateDevices AFTER mount for cross-browser compatibility
    await page.evaluate(() => {
      navigator.mediaDevices.enumerateDevices = async () => [
        { kind: 'audioinput', label: 'Built-in Mic', deviceId: 'builtin-mic-id', groupId: 'g1' },
        { kind: 'videoinput', label: 'Camera', deviceId: 'cam-id', groupId: 'g2' },
      ];
    });

    await page.evaluate(() => {
      window.mockCallObject.emit('mic-error', {
        errorMsg: 'Microphone not found',
        error: { type: 'not-found', message: 'Device not found' },
      });
    });

    // Should auto-switch — error should clear
    await expect(page.locator('text=Microphone blocked')).not.toBeVisible({ timeout: 8000 });

    const calls = await page.evaluate(() => window.mockCallObject._setInputDevicesCalls);
    const autoSwitch = calls.find((c) => c.audioDeviceId === 'builtin-mic-id');
    expect(autoSwitch).toBeTruthy();
  });

  /**
   * WF2-003: When camera not-found fires and MULTIPLE cameras are available,
   * show the device picker (don't auto-switch — let user choose).
   */
  test('WF2-003: multiple cameras shows picker instead of auto-switching', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Mock enumerateDevices AFTER mount for cross-browser compatibility
    await page.evaluate(() => {
      navigator.mediaDevices.enumerateDevices = async () => [
        { kind: 'videoinput', label: 'Built-in Camera', deviceId: 'cam1-id', groupId: 'g1' },
        { kind: 'videoinput', label: 'External Webcam', deviceId: 'cam2-id', groupId: 'g2' },
        { kind: 'audioinput', label: 'Built-in Mic', deviceId: 'mic-id', groupId: 'g3' },
      ];
    });

    await page.evaluate(() => {
      window.mockCallObject.emit('camera-error', {
        errorMsg: 'Camera not found',
        error: { type: 'not-found', message: 'Device not found' },
      });
    });

    // Should show device picker because there are multiple alternatives
    await expect(page.locator('[data-test="devicePickerSelect"]')).toBeVisible({ timeout: 8000 });
  });
});

// ---------------------------------------------------------------------------
// W7: Proactive track monitoring
// ---------------------------------------------------------------------------
// When a media track silently transitions from "live" to "ended" (browser
// killed it, device sleep, etc.), the user sees frozen video or dead audio
// with no indication. Proactive polling detects this and auto-recovers.
// ---------------------------------------------------------------------------

test.describe('W7: Proactive track monitoring', () => {
  /**
   * WF7-001: When the audio track readyState transitions to "ended" mid-call,
   * the component should detect this proactively and attempt auto-recovery
   * by calling setInputDevicesAsync to re-acquire the mic.
   */
  test('WF7-001: ended audio track triggers auto-recovery', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Simulate audio track ending silently (no Daily error event)
    await page.evaluate(() => {
      window.mockCallObject._audioReadyState = 'ended';
    });

    // The proactive monitor should detect the ended track and call
    // setInputDevicesAsync to re-acquire the microphone
    await expect.poll(async () => {
      const calls = await page.evaluate(() => window.mockCallObject._setInputDevicesCalls);
      return calls.some((c) => c.audioDeviceId !== undefined);
    }, { timeout: 20000, message: 'Expected setInputDevicesAsync to be called for mic re-acquisition' }).toBe(true);
  });

  /**
   * WF7-002: When the video track readyState transitions to "ended" mid-call,
   * the component should detect this proactively and attempt auto-recovery
   * by calling setInputDevicesAsync to re-acquire the camera.
   */
  test('WF7-002: ended video track triggers auto-recovery', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Simulate video track ending silently
    await page.evaluate(() => {
      window.mockCallObject._videoReadyState = 'ended';
    });

    // Proactive monitor should detect and call setInputDevicesAsync
    await expect.poll(async () => {
      const calls = await page.evaluate(() => window.mockCallObject._setInputDevicesCalls);
      return calls.some((c) => c.videoDeviceId !== undefined);
    }, { timeout: 20000, message: 'Expected setInputDevicesAsync to be called for camera re-acquisition' }).toBe(true);
  });

  /**
   * WF7-003: When track auto-recovery fires, a Sentry breadcrumb should be
   * logged so we can track how often tracks silently die in production.
   */
  test('WF7-003: track auto-recovery logs Sentry breadcrumb', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => window.mockSentryCaptures.reset());

    // Simulate audio track ending silently
    await page.evaluate(() => {
      window.mockCallObject._audioReadyState = 'ended';
    });

    // Wait for the monitor to detect and act
    await expect.poll(async () => {
      const calls = await page.evaluate(() => window.mockCallObject._setInputDevicesCalls);
      return calls.some((c) => c.audioDeviceId !== undefined);
    }, { timeout: 20000 }).toBe(true);

    // Should have logged a Sentry breadcrumb about the track recovery
    const captures = await page.evaluate(() => window.mockSentryCaptures);
    const trackBreadcrumb = captures.breadcrumbs.find(
      (b) => /track/i.test(b.category) || /track.*ended|auto.*recover/i.test(b.message)
    );
    expect(trackBreadcrumb).toBeTruthy();
  });
});
