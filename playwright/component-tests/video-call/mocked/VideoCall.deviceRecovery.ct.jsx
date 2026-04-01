import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { VideoCall } from "../../../../client/src/call/VideoCall";

/**
 * Component Tests for Device Error Recovery (Issue #1190)
 *
 * Device errors (camera-error, mic-error) are shown as a floating Modal over
 * the still-running call — the Call component stays mounted so remote tracks
 * are preserved. The modal can be closed via its X button to return to the call.
 *
 * Error titles are cause-specific (keyed on dailyErrorType):
 *   permissions → "Camera access denied" / "Microphone access denied"  (modal)
 *   in-use      → "Camera in use" / "Microphone in use"                (modal)
 *   not-found   → auto-fallback to system default + non-modal banner   (banner)
 *   constraints  → "Camera unavailable" / "Microphone unavailable"
 *   unknown     → "Camera problem" / "Microphone problem"
 *
 * For `not-found` errors, the system auto-switches to a fallback device and
 * shows a non-modal banner (data-testid="deviceFallbackBanner") instead of a
 * blocking modal. The banner auto-dismisses after 10s and has a close button
 * (data-testid="bannerDismiss"). Call tiles remain visible underneath.
 *
 * Camera and mic errors are shown sequentially: camera first (most critical),
 * then microphone, then speaker. Higher-priority errors are not overwritten
 * by lower-priority ones on the same device channel:
 *   permissions > in-use > not-found > constraints > unknown
 *
 * DEVRECOV-006 is run across all browser projects (chromium, firefox, webkit)
 * so the correct browser-specific permission image is verified for each context.
 */

const connectedConfig = {
  empirica: {
    currentPlayerId: "p0",
    players: [
      {
        id: "p0",
        attrs: { name: "Test User", position: "0", dailyId: "daily-p0" },
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
  },
};

test.describe("Device Error Recovery (Issue #1190)", () => {
  /**
   * DEVRECOV-001: Fix A/V button remains accessible after camera-error
   *
   * Device errors are shown as a floating modal over the call. The Tray
   * (including Fix A/V) should remain visible underneath so users have
   * an alternative recovery path beyond the modal's suggestions.
   */
  test("DEVRECOV-001: Fix A/V button accessible after camera-error event", async ({
    mount,
    page,
  }) => {
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: connectedConfig,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Fire camera-error mid-call (simulates monitor/device disconnect)
    await page.evaluate(() => {
      window.mockCallObject.emit("camera-error", {
        errorMsg: "Camera access denied",
        error: { type: "permissions", message: "Permission denied" },
      });
    });

    // Error message should be visible
    await expect(page.locator("text=Camera access denied")).toBeVisible({
      timeout: 8000,
    });

    // Fix A/V button should STILL be accessible so users can attempt to recover
    await expect(page.locator('[data-testid="fixAV"]')).toBeVisible();
  });

  /**
   * DEVRECOV-002: Fix A/V button remains accessible after mic-error
   *
   * Same as DEVRECOV-001 but for microphone errors — verifies the modal
   * overlay doesn't obscure the Tray's Fix A/V button.
   */
  test("DEVRECOV-002: Fix A/V button accessible after mic-error event", async ({
    mount,
    page,
  }) => {
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: connectedConfig,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      window.mockCallObject.emit("mic-error", {
        errorMsg: "Microphone access denied",
        error: { type: "permissions", message: "Permission denied" },
      });
    });

    await expect(page.locator("text=Microphone access denied")).toBeVisible({
      timeout: 8000,
    });

    // Fix A/V button should still be accessible
    await expect(page.locator('[data-testid="fixAV"]')).toBeVisible();
  });

  /**
   * DEVRECOV-003: Device error modal can be dismissed
   *
   * Users should be able to dismiss the error modal and attempt to continue
   * using the call (e.g. if the device issue was transient or if they plugged
   * back in and want to retry without a full page reload). The Modal's X
   * close button provides this.
   */
  test("DEVRECOV-003: device error modal has close button", async ({
    mount,
    page,
  }) => {
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: connectedConfig,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      window.mockCallObject.emit("camera-error", {
        error: { type: "in-use", message: "Camera in use by another app" },
      });
    });

    await expect(page.locator("text=Camera in use")).toBeVisible({
      timeout: 8000,
    });

    // Modal close button (X) should be available
    await expect(page.locator('button[aria-label="Close"]')).toBeVisible();
  });

  /**
   * DEVRECOV-004: Closing error modal restores call tile view
   *
   * After closing the error modal (via the X button), the call UI
   * (video tiles) should be fully visible again.
   */
  test("DEVRECOV-004: dismissing error restores call UI", async ({
    mount,
    page,
  }) => {
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: connectedConfig,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // First confirm normal call tile is visible before error
    await expect(component.locator('[data-testid="callTile"]')).toBeVisible({
      timeout: 10000,
    });

    // Trigger error (use in-use type to avoid W2 auto-switch for not-found)
    await page.evaluate(() => {
      window.mockCallObject.emit("camera-error", {
        error: { type: "in-use", message: "Camera in use by another app" },
      });
    });

    await expect(page.locator("text=Camera in use")).toBeVisible({
      timeout: 8000,
    });

    // Dismiss the error via the modal's X close button
    await page.locator('button[aria-label="Close"]').click();

    // Error message should be gone
    await expect(page.locator("text=Camera in use")).not.toBeVisible();

    // Normal call tiles should be restored
    await expect(component.locator('[data-testid="callTile"]')).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe("Device Error Recovery — Permission guidance (Issue #1190)", () => {
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
   */
  test("DEVRECOV-005: permissions error shows browser-specific guidance, not generic steps", async ({
    mount,
    page,
  }) => {
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: connectedConfig,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      window.mockCallObject.emit("camera-error", {
        errorMsg: "Camera access denied",
        error: { type: "permissions", message: "Permission denied" },
      });
    });

    await expect(page.locator("text=Camera access denied")).toBeVisible({
      timeout: 8000,
    });

    // Browser-specific guidance should appear
    await expect(
      page.locator("text=Please enable it in your browser settings")
    ).toBeVisible();

    // Generic steps should NOT appear when dailyErrorType is "permissions"
    await expect(page.locator("text=Close any other app")).not.toBeVisible();
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
   */
  test("DEVRECOV-006: shows browser-specific image for current browser", async ({
    mount,
    page,
    browserName,
  }) => {
    const imageMap = {
      chromium: "enable_webcam_fallback_chrome",
      firefox: "enable_webcam_fallback_firefox",
      webkit: "enable_webcam_fallback_safari",
    };
    const expectedImageSubstring = imageMap[browserName];

    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: connectedConfig,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      window.mockCallObject.emit("camera-error", {
        error: { type: "permissions", message: "Permission denied" },
      });
    });

    await expect(page.locator("text=Camera access denied")).toBeVisible({
      timeout: 8000,
    });

    // The image for the current browser should be rendered and actually loaded
    const img = page.locator(`img[src*="${expectedImageSubstring}"]`);
    await expect(img).toBeAttached({ timeout: 5000 });
    const naturalWidth = await img.evaluate((el) => el.naturalWidth);
    expect(
      naturalWidth,
      "browser-specific instruction image should load (naturalWidth > 0)"
    ).toBeGreaterThan(0);
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
   */
  test("DEVRECOV-007: auto-reloads when permissions are re-granted", async ({
    mount,
    page,
  }) => {
    // Track reload in Node.js scope via page.route — window.location.reload is
    // non-configurable in Chromium, so we can't redefine it in the browser.
    // Instead, intercept the document navigation request that reload() triggers.
    let reloadDetected = false;
    await page.route("**", async (route) => {
      if (
        route.request().isNavigationRequest() &&
        route.request().resourceType() === "document"
      ) {
        reloadDetected = true;
        await route.abort(); // Prevent actual navigation so test context stays alive
      } else {
        await route.continue();
      }
    });

    // Mock navigator.permissions to start as denied, then expose a helper to flip them
    await page.evaluate(() => {
      const camPerm = { state: "denied", onchange: null };
      const micPerm = { state: "denied", onchange: null };

      navigator.permissions.query = async ({ name }) => {
        if (name === "camera") return camPerm;
        if (name === "microphone") return micPerm;
        return { state: "prompt", onchange: null };
      };

      // Expose permission objects so we can verify the hook has subscribed
      window._mockCamPerm = camPerm;
      window._mockMicPerm = micPerm;

      window.simulatePermissionsGranted = () => {
        camPerm.state = "granted";
        micPerm.state = "granted";
        if (camPerm.onchange) camPerm.onchange();
        if (micPerm.onchange) micPerm.onchange();
      };
    });

    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: connectedConfig,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Fire permissions error
    await page.evaluate(() => {
      window.mockCallObject.emit("camera-error", {
        error: { type: "permissions", message: "Permission denied" },
      });
    });

    await expect(page.locator("text=Camera access denied")).toBeVisible({
      timeout: 8000,
    });

    // Wait for the permission monitoring hook to subscribe to onchange —
    // this confirms deniedOnMountRef has been captured and the hook is
    // ready to detect re-grant. On WebKit CI the async permissions query
    // + React re-render can be slow.
    await page.waitForFunction(
      () =>
        window._mockCamPerm?.onchange !== null &&
        window._mockMicPerm?.onchange !== null,
      { timeout: 10000 }
    );

    // User grants permissions in browser settings
    await page.evaluate(() => window.simulatePermissionsGranted());

    // The component should detect the permission change and call window.location.reload(),
    // which triggers a document navigation request — intercepted above.
    await expect.poll(() => reloadDetected, { timeout: 15000 }).toBe(true);
  });

  /**
   * DEVRECOV-008: in-use error still shows generic steps (regression guard)
   *
   * When dailyErrorType is "in-use" (another app is using the camera), the
   * generic bullet-point steps should be shown — not permission guidance, and
   * not the device picker (which only appears for "not-found" errors).
   */
  test("DEVRECOV-008: in-use error still shows generic steps", async ({
    mount,
    page,
  }) => {
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: connectedConfig,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      window.mockCallObject.emit("camera-error", {
        errorMsg: "Camera in use by another application",
        error: { type: "in-use", message: "Device in use" },
      });
    });

    await expect(page.locator("text=Camera in use")).toBeVisible({
      timeout: 8000,
    });

    // For in-use errors, cause-specific steps should be shown
    await expect(page.locator("text=Close any other app")).toBeVisible();

    // Browser-specific permission guidance should NOT appear
    await expect(
      page.locator("text=Please enable it in your browser settings")
    ).not.toBeVisible();

    // Device picker should NOT appear (only shown for not-found errors)
    await expect(
      page.locator('[data-testid="devicePickerSelect"]')
    ).not.toBeVisible();
  });
});

test.describe("Device Error Recovery — Not-found banner (Issue #1190)", () => {
  /**
   * DEVRECOV-009: camera not-found error shows fallback banner (not modal)
   *
   * When Daily fires camera-error with dailyErrorType "not-found" (device unplugged),
   * the system auto-switches to a fallback device and shows a non-modal banner.
   * No modal heading or device picker is shown. Call tiles remain visible.
   */
  test("DEVRECOV-009: camera not-found error shows fallback banner, not modal", async ({
    mount,
    page,
  }) => {
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: connectedConfig,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Mock enumerateDevices AFTER mount
    await page.evaluate(() => {
      navigator.mediaDevices.enumerateDevices = async () => [
        {
          kind: "videoinput",
          label: "Built-in Camera",
          deviceId: "camera-builtin-id",
        },
        {
          kind: "videoinput",
          label: "External Webcam",
          deviceId: "camera-external-id",
        },
        {
          kind: "audioinput",
          label: "Built-in Mic",
          deviceId: "mic-builtin-id",
        },
      ];
    });

    await page.evaluate(() => {
      window.mockCallObject.emit("camera-error", {
        errorMsg: "Camera not found",
        error: { type: "not-found", message: "Device not found" },
      });
    });

    // Banner should appear (not a modal)
    const banner = page.locator('[data-testid="deviceFallbackBanner"]');
    await expect(banner).toBeVisible({ timeout: 8000 });

    // Banner text should mention disconnection or switching
    const bannerText = await banner.textContent();
    expect(bannerText).toMatch(/disconnected|switched/i);

    // NO modal heading or device picker
    await expect(
      page.getByRole("heading", { name: "Camera not available" })
    ).not.toBeVisible();
    await expect(
      page.locator('[data-testid="devicePickerSelect"]')
    ).not.toBeVisible();

    // Call tiles remain visible underneath the banner
    await expect(component.locator('[data-testid="callTile"]')).toBeVisible({
      timeout: 5000,
    });
  });

  /**
   * DEVRECOV-010: mic not-found error shows fallback banner (not modal)
   *
   * Same as DEVRECOV-009 but for microphone errors.
   */
  test("DEVRECOV-010: mic not-found error shows fallback banner, not modal", async ({
    mount,
    page,
  }) => {
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: connectedConfig,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Mock enumerateDevices AFTER mount
    await page.evaluate(() => {
      navigator.mediaDevices.enumerateDevices = async () => [
        {
          kind: "videoinput",
          label: "Built-in Camera",
          deviceId: "camera-builtin-id",
        },
        {
          kind: "audioinput",
          label: "Built-in Microphone",
          deviceId: "mic-builtin-id",
        },
        {
          kind: "audioinput",
          label: "USB Headset Mic",
          deviceId: "mic-usb-id",
        },
      ];
    });

    await page.evaluate(() => {
      window.mockCallObject.emit("mic-error", {
        errorMsg: "Microphone not found",
        error: { type: "not-found", message: "Device not found" },
      });
    });

    // Banner should appear (not a modal)
    const banner = page.locator('[data-testid="deviceFallbackBanner"]');
    await expect(banner).toBeVisible({ timeout: 8000 });

    // Banner text should mention disconnection or switching
    const bannerText = await banner.textContent();
    expect(bannerText).toMatch(/disconnected|switched/i);

    // NO modal heading or device picker
    await expect(
      page.getByRole("heading", { name: "Microphone not available" })
    ).not.toBeVisible();
    await expect(
      page.locator('[data-testid="devicePickerSelect"]')
    ).not.toBeVisible();

    // Call tiles remain visible
    await expect(component.locator('[data-testid="callTile"]')).toBeVisible({
      timeout: 5000,
    });
  });

  /**
   * DEVRECOV-011: not-found banner can be dismissed and call tiles stay visible
   *
   * When a not-found error triggers the fallback banner, the banner can be
   * dismissed via its close button. Call tiles remain visible throughout.
   */
  test("DEVRECOV-011: not-found banner can be dismissed via close button", async ({
    mount,
    page,
  }) => {
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: connectedConfig,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Mock enumerateDevices AFTER mount
    await page.evaluate(() => {
      navigator.mediaDevices.enumerateDevices = async () => [
        {
          kind: "videoinput",
          label: "Built-in Camera",
          deviceId: "camera-builtin-id",
        },
        {
          kind: "videoinput",
          label: "External Webcam",
          deviceId: "camera-external-id",
        },
        {
          kind: "audioinput",
          label: "Built-in Mic",
          deviceId: "mic-builtin-id",
        },
      ];
    });
    await expect(component.locator('[data-testid="callTile"]')).toBeVisible({
      timeout: 10000,
    });

    // Trigger camera not-found error
    await page.evaluate(() => {
      window.mockCallObject.emit("camera-error", {
        error: { type: "not-found" },
      });
    });

    // Banner should appear (not a modal)
    const banner = page.locator('[data-testid="deviceFallbackBanner"]');
    await expect(banner).toBeVisible({ timeout: 8000 });

    // Call tiles remain visible underneath the banner
    await expect(component.locator('[data-testid="callTile"]')).toBeVisible();

    // Dismiss the banner via its close button
    await page.locator('[data-testid="bannerDismiss"]').click();

    // Banner should be gone
    await expect(banner).not.toBeVisible({ timeout: 3000 });

    // Call tiles still visible after dismiss
    await expect(component.locator('[data-testid="callTile"]')).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe("Device Error Recovery — Error priority (Issue #1190)", () => {
  /**
   * DEVRECOV-012: permissions error takes priority over in-use error
   *
   * When a lower-priority error (in-use) is showing and a higher-priority
   * error (permissions) arrives, the modal should update to show the
   * permissions error. This ensures users see the most actionable guidance.
   */
  test("DEVRECOV-012: permissions error overwrites in-use error", async ({
    mount,
    page,
  }) => {
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: connectedConfig,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Fire in-use error first
    await page.evaluate(() => {
      window.mockCallObject.emit("camera-error", {
        error: { type: "in-use", message: "Camera in use" },
      });
    });

    await expect(page.locator("text=Camera in use")).toBeVisible({
      timeout: 8000,
    });

    // Fire permissions error — should overwrite the in-use error
    await page.evaluate(() => {
      window.mockCallObject.emit("camera-error", {
        error: { type: "permissions", message: "Permission denied" },
      });
    });

    await expect(page.locator("text=Camera access denied")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator("text=Camera in use")).not.toBeVisible();
  });

  /**
   * DEVRECOV-013: lower-priority error does not overwrite higher-priority error
   *
   * When a permissions error is showing and an in-use error arrives,
   * the modal should keep showing the permissions error.
   */
  test("DEVRECOV-013: in-use error does not overwrite permissions error", async ({
    mount,
    page,
  }) => {
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: connectedConfig,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Fire permissions error first
    await page.evaluate(() => {
      window.mockCallObject.emit("camera-error", {
        error: { type: "permissions", message: "Permission denied" },
      });
    });

    await expect(page.locator("text=Camera access denied")).toBeVisible({
      timeout: 8000,
    });

    // Fire in-use error — should NOT overwrite the permissions error
    await page.evaluate(() => {
      window.mockCallObject.emit("camera-error", {
        error: { type: "in-use", message: "Camera in use" },
      });
    });

    // Wait briefly then verify permissions error is still showing
    await page.waitForTimeout(1000);
    await expect(page.locator("text=Camera access denied")).toBeVisible();
    await expect(page.locator("text=Camera in use")).not.toBeVisible();
  });

  /**
   * DEVRECOV-017: Preferred mic not in device list (alignment path) auto-switches with banner
   *
   * When a webcam+mic combo is unplugged, the OS auto-switches currentMic to the
   * built-in mic BEFORE Daily fires. alignMic() then finds: preferredMicId = webcam
   * mic (gone), findMatchingDevice → fallback = built-in, currentMic = built-in.
   *
   * New behavior: instead of showing a modal with a mic picker, the system
   * auto-switches to the fallback device and shows a non-modal banner.
   */
  test("DEVRECOV-017: preferred mic not found (alignment path) auto-switches with banner", async ({
    mount,
    page,
  }) => {
    const config = {
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
                deviceId: "builtin-cam-id",
                label: "FaceTime HD Camera",
              },
            },
          ],
          currentCam: {
            device: { deviceId: "builtin-cam-id", label: "FaceTime HD Camera" },
          },
          microphones: [
            {
              device: {
                deviceId: "builtin-mic-id",
                label: "MacBook Pro Microphone",
              },
            },
          ],
          // OS already switched to built-in mic
          currentMic: {
            device: {
              deviceId: "builtin-mic-id",
              label: "MacBook Pro Microphone",
            },
          },
        },
      },
    };

    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: config,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Banner should appear (not a modal) because preferred webcam mic is gone
    const banner = page.locator('[data-testid="deviceFallbackBanner"]');
    await expect(banner).toBeVisible({ timeout: 8000 });

    // Banner text should mention disconnection or switching
    const bannerText = await banner.textContent();
    expect(bannerText).toMatch(/disconnected|switched/i);

    // setInputDevicesAsync should have been called (auto-switch happened)
    const calls = await page.evaluate(
      () => window.mockCallObject._setInputDevicesCalls
    );
    expect(calls.length).toBeGreaterThan(0);

    // NO modal heading or device picker
    await expect(
      page.getByRole("heading", { name: "Microphone not available" })
    ).not.toBeVisible();
    await expect(
      page.locator('[data-testid="devicePickerSelect"]')
    ).not.toBeVisible();

    // Call tiles remain visible
    await expect(component.locator('[data-testid="callTile"]')).toBeVisible({
      timeout: 5000,
    });
  });

  /**
   * DEVRECOV-018: Preferred camera not in device list (alignment path) auto-switches with banner
   *
   * Same as DEVRECOV-017 but for the camera. When a webcam is unplugged,
   * the OS auto-switches currentCam to built-in. alignCamera() finds: preferred = webcam
   * (gone), fallback = built-in, currentCam = built-in.
   *
   * New behavior: auto-switches to fallback and shows a non-modal banner.
   */
  test("DEVRECOV-018: preferred camera not found (alignment path) auto-switches with banner", async ({
    mount,
    page,
  }) => {
    const config = {
      empirica: {
        currentPlayerId: "p0",
        players: [
          {
            id: "p0",
            attrs: {
              name: "Test User",
              position: "0",
              dailyId: "daily-p0",
              cameraId: "webcam-camera-id",
              cameraLabel: "Logitech HD Webcam",
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
          // OS already switched to built-in camera
          cameras: [
            {
              device: {
                deviceId: "builtin-cam-id",
                label: "FaceTime HD Camera",
              },
            },
          ],
          currentCam: {
            device: { deviceId: "builtin-cam-id", label: "FaceTime HD Camera" },
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
            device: {
              deviceId: "builtin-mic-id",
              label: "MacBook Pro Microphone",
            },
          },
        },
      },
    };

    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: config,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Banner should appear (not a modal) because preferred webcam is gone
    const banner = page.locator('[data-testid="deviceFallbackBanner"]');
    await expect(banner).toBeVisible({ timeout: 8000 });

    // Banner text should mention disconnection or switching
    const bannerText = await banner.textContent();
    expect(bannerText).toMatch(/disconnected|switched/i);

    // setInputDevicesAsync should have been called (auto-switch happened)
    const calls = await page.evaluate(
      () => window.mockCallObject._setInputDevicesCalls
    );
    expect(calls.length).toBeGreaterThan(0);

    // NO modal heading or device picker
    await expect(
      page.getByRole("heading", { name: "Camera not available" })
    ).not.toBeVisible();
    await expect(
      page.locator('[data-testid="devicePickerSelect"]')
    ).not.toBeVisible();

    // Call tiles remain visible
    await expect(component.locator('[data-testid="callTile"]')).toBeVisible({
      timeout: 5000,
    });
  });

  /**
   * DEVRECOV-014: camera + mic errors show sequentially (camera first, then mic)
   *
   * When both camera-error and mic-error fire, the errors are shown one at a time
   * in priority order: camera first (most critical), then microphone. The user
   * resolves each error independently — there is no merged "Camera and microphone"
   * title. This ensures the UX for each device is clear and actionable.
   */
  test("DEVRECOV-014: camera + mic errors show sequentially — camera first, then mic", async ({
    mount,
    page,
  }) => {
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: connectedConfig,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Fire camera permissions error
    await page.evaluate(() => {
      window.mockCallObject.emit("camera-error", {
        error: { type: "permissions", message: "Permission denied" },
      });
    });

    await expect(page.locator("text=Camera access denied")).toBeVisible({
      timeout: 8000,
    });

    // Fire mic permissions error — camera should still be shown (sequential, not merged)
    await page.evaluate(() => {
      window.mockCallObject.emit("mic-error", {
        error: { type: "permissions", message: "Permission denied" },
      });
    });

    // Camera error stays on top — no merged title
    await expect(page.locator("text=Camera access denied")).toBeVisible({
      timeout: 3000,
    });
    await expect(
      page.locator("text=Camera and microphone access denied")
    ).not.toBeVisible();

    // Close the camera modal — mic error should surface next
    // Use dispatchEvent to avoid webkit viewport-edge actionability failures
    await page.getByRole("button", { name: "Close" }).dispatchEvent("click");
    await expect(page.locator("text=Microphone access denied")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator("text=Camera access denied")).not.toBeVisible();
  });
});
