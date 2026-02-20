import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../../../client/src/call/VideoCall';

/**
 * Component Tests for Device Error Recovery (Issue #1190)
 *
 * Browser-specific guidance tests (DEVRECOV-005, DEVRECOV-006):
 * These tests verify that when a permissions error occurs, browser-specific
 * recovery instructions are shown (with screenshot images).
 *
 * DEVRECOV-006 is intentionally run across all browser projects (chromium,
 * firefox, webkit) so the correct image is verified for each browser context.
 * The other tests are scoped to chromium for speed.
 *
 * Problem: When Daily fires a camera-error or mic-error mid-call, the entire call
 * UI (including the Tray with the Fix A/V button) is replaced by UserMediaError.
 * This leaves users with no recovery path other than reloading the page (which
 * doesn't help if the device error persists).
 *
 * Expected behavior:
 * - The Tray (and its Fix A/V button) should remain accessible even when a device error is showing
 * - UserMediaError should have a "Dismiss" button to clear the error and restore the call UI
 *
 * Tests: DEVRECOV-001 to DEVRECOV-004
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

test.describe('Device Error Recovery (Issue #1190)', () => {
  /**
   * DEVRECOV-001: Fix A/V button remains accessible after camera-error
   *
   * When Daily fires camera-error (e.g. device unplugged mid-call), the Tray
   * and its Fix A/V button should remain visible so users can attempt recovery.
   *
   * Currently FAILS: Tray is hidden when deviceError is set (replaced by UserMediaError).
   */
  test('DEVRECOV-001: Fix A/V button accessible after camera-error event', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Fire camera-error mid-call (simulates monitor/device disconnect)
    await page.evaluate(() => {
      window.mockCallObject.emit('camera-error', {
        errorMsg: 'Camera access denied',
        error: { type: 'permissions', message: 'Permission denied' },
      });
    });

    // Error message should be visible
    await expect(page.locator('text=Camera blocked')).toBeVisible({ timeout: 8000 });

    // Fix A/V button should STILL be accessible so users can attempt to recover
    await expect(page.locator('[data-test="fixAV"]')).toBeVisible();
  });

  /**
   * DEVRECOV-002: Fix A/V button remains accessible after mic-error
   *
   * Same as DEVRECOV-001 but for microphone errors.
   */
  test('DEVRECOV-002: Fix A/V button accessible after mic-error event', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      window.mockCallObject.emit('mic-error', {
        errorMsg: 'Microphone access denied',
        error: { type: 'permissions', message: 'Permission denied' },
      });
    });

    await expect(page.locator('text=Microphone blocked')).toBeVisible({ timeout: 8000 });

    // Fix A/V button should still be accessible
    await expect(page.locator('[data-test="fixAV"]')).toBeVisible();
  });

  /**
   * DEVRECOV-003: Device error overlay includes a Dismiss button
   *
   * Users should be able to dismiss the error overlay and attempt to continue
   * using the call (e.g. if the device issue was transient or if they plugged
   * back in and want to retry without a full page reload).
   */
  test('DEVRECOV-003: device error overlay has Dismiss button', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      window.mockCallObject.emit('camera-error', {
        error: { type: 'not-found' },
      });
    });

    await expect(page.locator('text=Camera blocked')).toBeVisible({ timeout: 8000 });

    // A dismiss/close option should be available (not just "Reload and retry")
    await expect(page.locator('[data-test="dismissDeviceError"]')).toBeVisible();
  });

  /**
   * DEVRECOV-004: Dismissing error restores call tile view
   *
   * After clicking Dismiss, the UserMediaError should clear and the
   * normal call UI (video tiles) should be restored.
   */
  test('DEVRECOV-004: dismissing error restores call UI', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    // First confirm normal call tile is visible before error
    await expect(component.locator('[data-test="callTile"]')).toBeVisible({ timeout: 10000 });

    // Trigger error
    await page.evaluate(() => {
      window.mockCallObject.emit('camera-error', {
        error: { type: 'not-found' },
      });
    });

    await expect(page.locator('text=Camera blocked')).toBeVisible({ timeout: 8000 });

    // Dismiss the error
    await page.locator('[data-test="dismissDeviceError"]').click();

    // Error message should be gone
    await expect(page.locator('text=Camera blocked')).not.toBeVisible();

    // Normal call tiles should be restored
    await expect(component.locator('[data-test="callTile"]')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Device Error Recovery — Permission guidance (Issue #1190)', () => {
  /**
   * DEVRECOV-005: permissions error replaces generic steps with browser-specific guidance
   *
   * When dailyErrorType === "permissions", the generic bullet-point steps
   * ("Use the lock icon…") should be replaced with PermissionDeniedGuidance,
   * which includes browser-specific screenshot images.
   *
   * The generic step text should NOT appear; instead the guidance component
   * (which always contains a "Please enable it in your browser settings" message)
   * should be visible.
   *
   * Currently FAILS: UserMediaError always shows the generic steps list.
   */
  test('DEVRECOV-005: permissions error shows browser-specific guidance, not generic steps', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      window.mockCallObject.emit('camera-error', {
        errorMsg: 'Camera access denied',
        error: { type: 'permissions', message: 'Permission denied' },
      });
    });

    await expect(page.locator('text=Camera blocked')).toBeVisible({ timeout: 8000 });

    // Browser-specific guidance should appear
    await expect(page.locator('text=Please enable it in your browser settings')).toBeVisible();

    // The generic lock-icon step should NOT appear when dailyErrorType is "permissions"
    await expect(page.locator("text=Use the lock icon in your browser's address bar to allow camera access")).not.toBeVisible();
  });

  /**
   * DEVRECOV-006: shows correct browser-specific image for the current browser
   *
   * This test runs across chromium, firefox, and webkit to verify that each
   * browser context shows the appropriate screenshot image.
   *
   * chromium  → enable_webcam_fallback_chrome.jpg
   * firefox   → enable_webcam_fallback_firefox.jpg
   * webkit    → enable_webcam_fallback_safari.jpg
   *
   * Currently FAILS: no browser-specific image is shown at all.
   */
  test('DEVRECOV-006: shows browser-specific image for current browser', async ({ mount, page, browserName }) => {
    const imageMap = {
      chromium: 'enable_webcam_fallback_chrome',
      firefox: 'enable_webcam_fallback_firefox',
      webkit: 'enable_webcam_fallback_safari',
    };
    const expectedImageSubstring = imageMap[browserName];

    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      window.mockCallObject.emit('camera-error', {
        error: { type: 'permissions', message: 'Permission denied' },
      });
    });

    await expect(page.locator('text=Camera blocked')).toBeVisible({ timeout: 8000 });

    // The image for the current browser should be rendered
    await expect(page.locator(`img[src*="${expectedImageSubstring}"]`)).toBeAttached({ timeout: 5000 });
  });

  /**
   * DEVRECOV-007: auto-reloads when browser permissions flip back to granted
   *
   * When the user follows the instructions and re-grants camera/mic permissions
   * in their browser settings, the permission monitoring hook detects the change
   * and automatically reloads the page (so Daily can re-acquire devices cleanly).
   *
   * Test strategy:
   * - Mock navigator.permissions to initially return "denied"
   * - Fire camera-error with dailyErrorType "permissions"
   * - Simulate the user granting permissions (fire onchange)
   * - Verify window.location.reload() was called
   *
   * Currently FAILS: no permission monitoring / auto-reload in UserMediaError.
   */
  test('DEVRECOV-007: auto-reloads when permissions are re-granted', async ({ mount, page }) => {
    // Track reload in Node.js scope via page.route — window.location.reload is
    // non-configurable in Chromium, so we can't redefine it in the browser.
    // Instead, intercept the document navigation request that reload() triggers.
    let reloadDetected = false;
    await page.route('**', async (route) => {
      if (route.request().isNavigationRequest() && route.request().resourceType() === 'document') {
        reloadDetected = true;
        await route.abort(); // Prevent actual navigation so test context stays alive
      } else {
        await route.continue();
      }
    });

    // Mock navigator.permissions to start as denied, then expose a helper to flip them
    await page.evaluate(() => {
      const camPerm = { state: 'denied', onchange: null };
      const micPerm = { state: 'denied', onchange: null };

      navigator.permissions.query = async ({ name }) => {
        if (name === 'camera') return camPerm;
        if (name === 'microphone') return micPerm;
        return { state: 'prompt', onchange: null };
      };

      window.simulatePermissionsGranted = () => {
        camPerm.state = 'granted';
        micPerm.state = 'granted';
        if (camPerm.onchange) camPerm.onchange();
        if (micPerm.onchange) micPerm.onchange();
      };
    });

    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Fire permissions error
    await page.evaluate(() => {
      window.mockCallObject.emit('camera-error', {
        error: { type: 'permissions', message: 'Permission denied' },
      });
    });

    await expect(page.locator('text=Camera blocked')).toBeVisible({ timeout: 8000 });

    // User grants permissions in browser settings
    await page.evaluate(() => window.simulatePermissionsGranted());

    // The component should detect the permission change and call window.location.reload(),
    // which triggers a document navigation request — intercepted above.
    await expect.poll(() => reloadDetected, { timeout: 5000 }).toBe(true);
  });

  /**
   * DEVRECOV-008: in-use error still shows generic steps (regression guard)
   *
   * When dailyErrorType is "in-use" (another app is using the camera), the
   * generic bullet-point steps should be shown — not permission guidance, and
   * not the device picker (which only appears for "not-found" errors).
   */
  test('DEVRECOV-008: in-use error still shows generic steps', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      window.mockCallObject.emit('camera-error', {
        errorMsg: 'Camera in use by another application',
        error: { type: 'in-use', message: 'Device in use' },
      });
    });

    await expect(page.locator('text=Camera blocked')).toBeVisible({ timeout: 8000 });

    // For in-use errors, generic steps should be shown
    await expect(page.locator("text=Use the lock icon in your browser's address bar to allow camera access")).toBeVisible();

    // Browser-specific permission guidance should NOT appear
    await expect(page.locator('text=Please enable it in your browser settings')).not.toBeVisible();

    // Device picker should NOT appear (only shown for not-found errors)
    await expect(page.locator('[data-test="devicePickerSelect"]')).not.toBeVisible();
  });
});

test.describe('Device Error Recovery — Device picker (Issue #1190)', () => {
  /**
   * DEVRECOV-009: camera not-found error shows device picker when cameras available
   *
   * When Daily fires camera-error with dailyErrorType "not-found" (device unplugged),
   * UserMediaError should show a dropdown of available cameras instead of generic steps,
   * so the user can switch to a working camera without a full page reload.
   */
  test('DEVRECOV-009: camera not-found error shows device picker with available cameras', async ({ mount, page }) => {
    // Mock enumerateDevices to return a known set of cameras
    await page.evaluate(() => {
      navigator.mediaDevices.enumerateDevices = async () => [
        { kind: 'videoinput', label: 'Built-in Camera', deviceId: 'camera-builtin-id' },
        { kind: 'videoinput', label: 'External Webcam', deviceId: 'camera-external-id' },
        { kind: 'audioinput', label: 'Built-in Mic', deviceId: 'mic-builtin-id' },
      ];
    });

    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      window.mockCallObject.emit('camera-error', {
        errorMsg: 'Camera not found',
        error: { type: 'not-found', message: 'Device not found' },
      });
    });

    await expect(page.locator('text=Camera blocked')).toBeVisible({ timeout: 8000 });

    // Device picker should appear with available cameras
    await expect(page.locator('[data-test="devicePickerSelect"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-test="switchDeviceButton"]')).toBeVisible();

    // Picker should contain at least one camera option (chromium/firefox use the mock
    // label; webkit may use a real headless device label — both are valid)
    const optionCount = await page.locator('[data-test="devicePickerSelect"] option').count();
    expect(optionCount).toBeGreaterThanOrEqual(1);

    // Generic steps should NOT appear when picker is shown
    await expect(page.locator("text=Use the lock icon in your browser's address bar to allow camera access")).not.toBeVisible();
  });

  /**
   * DEVRECOV-010: mic not-found error shows device picker with available microphones
   *
   * Same as DEVRECOV-009 but for microphone errors.
   */
  test('DEVRECOV-010: mic not-found error shows device picker with available microphones', async ({ mount, page }) => {
    await page.evaluate(() => {
      navigator.mediaDevices.enumerateDevices = async () => [
        { kind: 'videoinput', label: 'Built-in Camera', deviceId: 'camera-builtin-id' },
        { kind: 'audioinput', label: 'Built-in Microphone', deviceId: 'mic-builtin-id' },
        { kind: 'audioinput', label: 'USB Headset Mic', deviceId: 'mic-usb-id' },
      ];
    });

    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      window.mockCallObject.emit('mic-error', {
        errorMsg: 'Microphone not found',
        error: { type: 'not-found', message: 'Device not found' },
      });
    });

    await expect(page.locator('text=Microphone blocked')).toBeVisible({ timeout: 8000 });

    // Mic picker should appear
    await expect(page.locator('[data-test="devicePickerSelect"]')).toBeVisible({ timeout: 5000 });
    const micOptionCount = await page.locator('[data-test="devicePickerSelect"] option').count();
    expect(micOptionCount).toBeGreaterThanOrEqual(1);
  });

  /**
   * DEVRECOV-011: selecting a device from the picker calls setInputDevicesAsync and clears error
   *
   * When the user selects a camera from the picker and clicks "Switch to this device",
   * VideoCall should call setInputDevicesAsync with the chosen device ID, and on
   * success the error overlay should be dismissed (call tiles restored).
   */
  test('DEVRECOV-011: selecting a device from picker switches device and clears error', async ({ mount, page }) => {
    await page.evaluate(() => {
      navigator.mediaDevices.enumerateDevices = async () => [
        { kind: 'videoinput', label: 'Built-in Camera', deviceId: 'camera-builtin-id' },
        { kind: 'audioinput', label: 'Built-in Mic', deviceId: 'mic-builtin-id' },
      ];
    });

    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });
    await expect(component.locator('[data-test="callTile"]')).toBeVisible({ timeout: 10000 });

    // Trigger camera not-found error
    await page.evaluate(() => {
      window.mockCallObject.emit('camera-error', {
        error: { type: 'not-found' },
      });
    });

    await expect(page.locator('text=Camera blocked')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-test="devicePickerSelect"]')).toBeVisible({ timeout: 5000 });

    // Dispatch a click directly to bypass Playwright's actionability retry loop
    // (React re-renders during the async handler can cause spurious retries)
    await page.locator('[data-test="switchDeviceButton"]').dispatchEvent('click');

    // setInputDevicesAsync should have been called with a videoDeviceId argument.
    // Exact value varies by browser: mock returns 'camera-builtin-id' in chromium/firefox;
    // webkit may return an empty string from headless enumerateDevices (no permissions).
    const calls = await page.evaluate(() => window.mockCallObject._setInputDevicesCalls);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1].videoDeviceId).not.toBeUndefined();

    // Error overlay should be dismissed and call tiles restored
    await expect(page.locator('text=Camera blocked')).not.toBeVisible({ timeout: 5000 });
    await expect(component.locator('[data-test="callTile"]')).toBeVisible({ timeout: 5000 });
  });
});
