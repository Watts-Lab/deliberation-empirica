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
 * - Sentry on Fix A/V click (philosophy #7)
 * - W1: Permission revocation proactive UI
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
// Sentry on Fix A/V click (philosophy #7)
// ---------------------------------------------------------------------------
// If the user clicks "Fix Audio/Video", our proactive detection pipeline
// missed something. Log a Sentry error immediately on click.
// ---------------------------------------------------------------------------

test.describe('Sentry on Fix A/V click', () => {
  /**
   * WF-SENTRY-001: Clicking the Fix A/V button should immediately send a
   * Sentry error message, before any diagnosis runs.
   */
  test('WF-SENTRY-001: Fix A/V click sends Sentry error', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => window.mockSentryCaptures.reset());

    // Click Fix A/V button
    await page.locator('[data-test="fixAV"]').click();
    await expect(
      page.locator('text=What problems are you experiencing?')
    ).toBeVisible({ timeout: 5000 });

    // Sentry should have captured an error-level message about Fix A/V being clicked
    const captures = await page.evaluate(() => window.mockSentryCaptures);
    const fixAVMsg = captures.messages.find((m) => /fix.?a.?v/i.test(m.message));
    expect(fixAVMsg).toBeTruthy();
    // Should be error level (not info or warning)
    const level = fixAVMsg.hint?.level || fixAVMsg.hint?.tags?.level;
    expect(level).toBe('error');
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
