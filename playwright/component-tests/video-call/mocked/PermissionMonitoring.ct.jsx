import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../../../client/src/call/VideoCall';
import { Tray } from '../../../../client/src/call/Tray';
import { setupConsoleCapture } from '../../../mocks/console-capture.js';

/**
 * Component Tests for Browser Permission Monitoring
 * Related: PR #1161, VideoCall.jsx permission monitoring effect
 * Tests: PERM-001 to PERM-004
 *
 * Strategy: Override navigator.permissions with a controllable mock so tests
 * can observe what the VideoCall permission-monitoring effect does with it, and
 * trigger synthetic onchange events to simulate runtime permission revocation.
 *
 * Mock structure:
 *   navigator.permissions.query({ name: 'camera' }) → mockCamPerm object
 *   navigator.permissions.query({ name: 'microphone' }) → mockMicPerm object
 *   window.mockCamPerm / window.mockMicPerm → exposed for test control
 *   window.triggerPermChange(type, newState) → fires onchange with new state
 *
 * VideoCall's monitorPermissions() effect:
 *   - Calls query() for camera and microphone
 *   - Sets camPerm.onchange = handlePermChange("camera", camPerm)
 *   - handlePermChange logs console.warn for any change
 *   - handlePermChange logs console.error when state === 'denied'
 */

const baseConfig = {
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

/**
 * Install a controllable navigator.permissions mock in the page.
 *
 * The mock uses Object.defineProperty so the VideoCall effect can set
 * `onchange` on the returned PermissionStatus objects. The test can then
 * call window.triggerPermChange(type, newState) to simulate permission changes.
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

    const mockPermissions = {
      query: async ({ name }) => name === 'camera' ? camPerm : micPerm,
    };

    // navigator.permissions is a getter-only property on the Navigator prototype
    // in Chrome — direct assignment silently fails in non-strict mode. Use
    // Object.defineProperty to create an own property that shadows the prototype getter.
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      get: () => mockPermissions,
    });

    window.mockCamPerm = camPerm;
    window.mockMicPerm = micPerm;

    // Trigger a synthetic permission change from test code:
    //   window.triggerPermChange('camera', 'denied')
    window.triggerPermChange = (type, newState) => {
      const perm = type === 'camera' ? camPerm : micPerm;
      perm.state = newState;
      // VideoCall sets perm.onchange directly, so call it
      if (perm._onchange) perm._onchange(new Event('change'));
    };
  }, { cam: initialCamState, mic: initialMicState });
}

/**
 * Wait for VideoCall's monitorPermissions() useEffect to run and set
 * onchange handlers on the mock permission objects.
 */
async function waitForPermHandlers(page) {
  await page.waitForFunction(
    () => !!window.mockCamPerm?._onchange && !!window.mockMicPerm?._onchange,
    { timeout: 10000 }
  );
}

test.describe('Permission Monitoring', () => {
  /**
   * PERM-001: Camera permission change → console.warn logged
   *
   * When a camera permission change event fires, VideoCall logs:
   *   console.warn("[Permissions] camera permission changed to: <newState>")
   *
   * This warning appears in Sentry breadcrumbs, helping diagnose why calls
   * fail after the user accidentally revokes camera access.
   */
  test('PERM-001: camera permission change logs console warning', async ({ mount, page }) => {
    test.slow();
    const consoleCapture = setupConsoleCapture(page);
    await installPermissionsMock(page);

    const component = await mount(
      <div style={{ width: '800px', height: '600px', position: 'relative' }}>
        <VideoCall showSelfView />
      </div>,
      { hooksConfig: baseConfig }
    );
    await expect(component).toBeVisible({ timeout: 15000 });

    // Wait for monitorPermissions() to set onchange handlers
    await waitForPermHandlers(page);

    // Simulate camera permission changing (e.g. user visits site settings and
    // changes permission while call is in progress — or tab goes inactive)
    await page.evaluate(() => window.triggerPermChange('camera', 'prompt'));
    await page.waitForTimeout(200);

    const warnLogs = consoleCapture.matching(/\[Permissions\] camera permission changed/i);
    expect(warnLogs.length).toBeGreaterThanOrEqual(1);
    expect(warnLogs[0].text).toContain('prompt');
  });

  /**
   * PERM-002: Mic permission change → console.warn logged
   *
   * Same as PERM-001 but for the microphone permission.
   */
  test('PERM-002: mic permission change logs console warning', async ({ mount, page }) => {
    test.slow();
    const consoleCapture = setupConsoleCapture(page);
    await installPermissionsMock(page);

    const component = await mount(
      <div style={{ width: '800px', height: '600px', position: 'relative' }}>
        <VideoCall showSelfView />
      </div>,
      { hooksConfig: baseConfig }
    );
    await expect(component).toBeVisible({ timeout: 15000 });
    await waitForPermHandlers(page);

    await page.evaluate(() => window.triggerPermChange('microphone', 'prompt'));
    await page.waitForTimeout(200);

    const warnLogs = consoleCapture.matching(/\[Permissions\] microphone permission changed/i);
    expect(warnLogs.length).toBeGreaterThanOrEqual(1);
    expect(warnLogs[0].text).toContain('prompt');
  });

  /**
   * PERM-003: Permission revoked to 'denied' → additional console.error logged
   *
   * When a permission changes specifically to 'denied' (not just 'prompt'),
   * VideoCall logs an additional error level message:
   *   console.error("[Permissions] camera permission DENIED during call!")
   *
   * This error level ensures it appears prominently in Sentry and alerts
   * engineers to permission revocation as a root cause of AV failures.
   */
  test('PERM-003: permission denied fires console.error', async ({ mount, page }) => {
    test.slow();
    const consoleCapture = setupConsoleCapture(page);
    await installPermissionsMock(page);

    const component = await mount(
      <div style={{ width: '800px', height: '600px', position: 'relative' }}>
        <VideoCall showSelfView />
      </div>,
      { hooksConfig: baseConfig }
    );
    await expect(component).toBeVisible({ timeout: 15000 });
    await waitForPermHandlers(page);

    // Revoke camera permission entirely
    await page.evaluate(() => window.triggerPermChange('camera', 'denied'));
    await page.waitForTimeout(200);

    // Should have both a warning and an error
    const warnLogs = consoleCapture.matching(/\[Permissions\] camera permission changed/i);
    const errorLogs = consoleCapture.matching(/\[Permissions\] camera permission DENIED/i);
    expect(warnLogs.length).toBeGreaterThanOrEqual(1);
    expect(errorLogs.length).toBeGreaterThanOrEqual(1);
  });

  /**
   * PERM-004: browserPermissions field in Sentry reportedAVError
   *
   * collectAVDiagnostics() reads navigator.permissions.query() for camera
   * and microphone, then includes the result in the Sentry report as:
   *   extra.beforeDiagnostics.browserPermissions.camera
   *   extra.beforeDiagnostics.browserPermissions.microphone
   *
   * This test mocks camera as 'denied' and runs the full Fix A/V flow to
   * verify the permissions state is captured in the Sentry capture.
   *
   * Uses the AudioContext suspended → running mock to get the fix to succeed
   * (so captureMessage fires). Camera permission 'denied' is surfaced as
   * diagnostic context, not as a fixable cause, so it doesn't block success.
   */
  test('PERM-004: browserPermissions captured in Sentry reportedAVError', async ({ mount, page }) => {
    test.slow();

    // Mock camera permission as 'denied' so collectAVDiagnostics captures it
    await installPermissionsMock(page, 'denied', 'granted');

    // Mock AudioContext suspended → running to give the fix something to fix
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

    const component = await mount(<Tray {...trayProps} />, { hooksConfig: baseConfig });

    // Run the full Fix A/V flow
    await component.locator('[data-test="fixAV"]').click();
    await component.locator("text=I can't hear other participants").click();
    await component.locator('button:has-text("Diagnose & Fix")').click();

    // Wait for fix to complete (captureMessage fires after success/failure)
    await expect(component.locator('text=Issue resolved')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(200);

    // Verify Sentry captured reportedAVError with permission state
    const sentryMessages = await page.evaluate(() => window.mockSentryCaptures?.messages || []);
    const avErrorReport = sentryMessages.find((m) => m.message === 'reportedAVError');

    expect(avErrorReport).toBeTruthy();
    // Sentry.captureMessage(msg, hint) → stored as { message, hint }
    // reportData is in hint.extra; browserPermissions is in beforeDiagnostics
    expect(avErrorReport.hint?.extra?.beforeDiagnostics?.browserPermissions?.camera).toBe('denied');
    expect(avErrorReport.hint?.extra?.beforeDiagnostics?.browserPermissions?.microphone).toBe('granted');
  });
});
