import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../../../client/src/call/VideoCall';
import { setupConsoleCapture } from '../../../mocks/console-capture.js';

/**
 * Component Tests for AudioContext Monitoring
 *
 * Related: PR #1161, Issue #1159 (Safari AudioContext suspended on join)
 * Tests: AUDIO-001 to AUDIO-006
 *
 * Tests the useAudioContextMonitor hook behavior via VideoCall component.
 * Uses page.evaluate() to mock window.AudioContext before mounting so the
 * hook picks up the mocked state on initialization.
 *
 * The enable-audio banner appears when needsUserInteraction is true,
 * which happens when AudioContext state === 'suspended'.
 * See VideoCall.jsx lines 754-771 for the banner rendering.
 */

const baseConfig = {
  empirica: {
    currentPlayerId: 'p0',
    players: [{
      id: 'p0',
      attrs: { position: '0', dailyId: 'daily-p0', name: 'Test User' },
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
  },
};

test.describe('AudioContext banner behavior', () => {
  // Force serial mode to avoid parallel mount resource contention
  test.describe.configure({ mode: 'serial' });

  /**
   * AUDIO-001: Detects suspended AudioContext
   * Validates: useAudioContextMonitor detects when AudioContext is suspended
   */
  test('AUDIO-001: detects suspended AudioContext state', async ({ mount, page }) => {
    test.slow(); // Give extra time - VideoCall is heavy
    await page.evaluate(() => {
      window.AudioContext = class MockAudioContext {
        constructor() {
          this.state = 'suspended';
          this._listeners = {};
        }
        addEventListener(type, handler) { this._listeners[type] = handler; }
        removeEventListener(type, handler) { delete this._listeners[type]; }
        resume() { return Promise.resolve(); }
        close() { this.state = 'closed'; return Promise.resolve(); }
      };
      window.webkitAudioContext = window.AudioContext;
    });

    const component = await mount(<VideoCall showSelfView />, { hooksConfig: baseConfig });

    // The banner should appear because AudioContext is suspended
    await expect(component.locator('text=Audio is paused')).toBeVisible({ timeout: 10000 });
  });

  /**
   * AUDIO-002: Shows enable audio banner when AudioContext suspended
   * Validates: Banner with "Enable audio" button visible when suspended
   */
  test('AUDIO-002: shows enable audio banner when suspended', async ({ mount, page }) => {
    test.slow();
    await page.evaluate(() => {
      window.AudioContext = class MockAudioContext {
        constructor() {
          this.state = 'suspended';
          this._listeners = {};
        }
        addEventListener(type, handler) { this._listeners[type] = handler; }
        removeEventListener(type, handler) { delete this._listeners[type]; }
        resume() { return Promise.resolve(); }
        close() { this.state = 'closed'; return Promise.resolve(); }
      };
      window.webkitAudioContext = window.AudioContext;
    });

    const component = await mount(<VideoCall showSelfView />, { hooksConfig: baseConfig });

    await expect(page.locator('text=Audio is paused. Click below to enable sound.')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Enable audio")')).toBeVisible();
  });

  /**
   * AUDIO-003: Resume on button click
   * Validates: Clicking "Enable audio" calls audioContext.resume() and hides the banner
   */
  test('AUDIO-003: clicking enable audio hides the banner', async ({ mount, page }) => {
    test.slow();
    await page.evaluate(() => {
      const mockCtx = {
        state: 'suspended',
        _listeners: {},
        addEventListener(type, handler) { this._listeners[type] = handler; },
        removeEventListener(type, handler) { delete this._listeners[type]; },
        resume() {
          this.state = 'running';
          // Fire statechange event so React state updates
          if (this._listeners.statechange) {
            this._listeners.statechange(new Event('statechange'));
          }
          return Promise.resolve();
        },
        close() { this.state = 'closed'; return Promise.resolve(); },
      };
      window.AudioContext = function() { return mockCtx; };
      window.webkitAudioContext = window.AudioContext;
      // Mock document.hasFocus to return true (prevents joinStalled overlay)
      document.hasFocus = () => true;
    });

    const component = await mount(<VideoCall showSelfView />, { hooksConfig: baseConfig });

    // Banner should appear
    const enableButton = page.locator('button:has-text("Enable audio")');
    await expect(enableButton).toBeVisible({ timeout: 10000 });

    // Wait for component to stabilize
    await page.waitForTimeout(500);

    // Click to enable audio
    await enableButton.click();

    // Banner should disappear after resume
    await expect(page.locator('text=Audio is paused')).not.toBeVisible({ timeout: 5000 });
  });

  /**
   * AUDIO-005: No banner when AudioContext is running
   * Validates: Banner does NOT appear when AudioContext starts in 'running' state
   */
  test('AUDIO-005: no banner when AudioContext is running', async ({ mount, page }) => {
    test.slow();
    // Mock AudioContext to start running
    await page.evaluate(() => {
      window.AudioContext = class MockAudioContext {
        constructor() {
          this.state = 'running';
          this._listeners = {};
        }
        addEventListener(type, handler) { this._listeners[type] = handler; }
        removeEventListener(type, handler) { delete this._listeners[type]; }
        resume() { return Promise.resolve(); }
        close() { this.state = 'closed'; return Promise.resolve(); }
      };
      window.webkitAudioContext = window.AudioContext;
    });

    const component = await mount(<VideoCall showSelfView />, { hooksConfig: baseConfig });

    // Wait for component to render and effects to run
    await expect(component).toBeVisible({ timeout: 15000 });

    // Banner should NOT appear - audio is already running
    await expect(page.locator('text=Audio is paused')).not.toBeVisible();
    await expect(page.locator('button:has-text("Enable audio")')).not.toBeVisible();
  });

  /**
   * AUDIO-004: Auto-resume attempts after user gesture
   * Validates: The 5-second interval in useAudioContextMonitor calls ctx.resume()
   * when AudioContext is suspended AND a new user gesture has been detected.
   *
   * Uses page.clock to replace browser timers with a controllable fake clock,
   * then advances time past the 5-second interval to trigger the auto-resume.
   *
   * Condition for auto-resume: ctx.state === 'suspended' AND
   * lastGestureIdRef.current > lastAttemptedGestureIdRef.current
   */
  test('AUDIO-004: auto-resume attempts when suspended and gesture detected', async ({ mount, page }) => {
    test.slow();
    const consoleCapture = setupConsoleCapture(page);

    // Install fake clock BEFORE mount so the setInterval in useEffect uses it.
    // Playwright's clock.install() patches Date, setTimeout, setInterval, etc.
    // in the browser context. Playwright's own assertion timeouts use real time
    // and are unaffected.
    await page.clock.install();

    // Mock AudioContext with a spy on resume() so we can verify it was called.
    // The mock starts suspended so auto-resume is eligible to fire.
    await page.evaluate(() => {
      const mockCtx = {
        state: 'suspended',
        _listeners: {},
        resumeCallCount: 0,
        addEventListener(type, handler) { this._listeners[type] = handler; },
        removeEventListener(type, handler) { delete this._listeners[type]; },
        resume() {
          this.resumeCallCount++;
          return Promise.resolve();
        },
        close() { this.state = 'closed'; return Promise.resolve(); },
      };
      window.AudioContext = function() { return mockCtx; };
      window.webkitAudioContext = window.AudioContext;
      window.mockAudioCtx = mockCtx;
    });

    const component = await mount(<VideoCall showSelfView />, { hooksConfig: baseConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Drain any mount-time pointer interactions: Playwright's mount() dispatches
    // internal events that the hook's pointerdown listener registers as gestures.
    // Run two full interval cycles to exhaust those, then reset the spy count so
    // we get a clean baseline for the real test assertion.
    await page.clock.fastForward(10100);
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.mockAudioCtx.resumeCallCount = 0; });

    // Simulate a fresh user gesture — increments lastGestureIdRef above lastAttemptedGestureIdRef
    await page.evaluate(() => {
      document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });

    // Advance one full interval — gesture guard now satisfied, resume() should fire
    await page.clock.fastForward(5100);
    await page.waitForTimeout(200);

    const resumeCount = await page.evaluate(() => window.mockAudioCtx.resumeCallCount);
    expect(resumeCount).toBeGreaterThanOrEqual(1);

    // Hook should log the auto-resume attempt
    const autoResumeLogs = consoleCapture.matching(/auto-resume/i);
    expect(autoResumeLogs.length).toBeGreaterThanOrEqual(1);
  });

  /**
   * AUDIO-006: Logs AudioContext state changes
   * Validates: useAudioContextMonitor emits console.log on creation and on
   * statechange events so engineers can trace audio issues in production logs.
   *
   * Expected logs (from useAudioContextMonitor.js):
   *   "[Audio] AudioContext created, initial state: suspended"
   *   "[Audio] AudioContext state changed: running"
   */
  test('AUDIO-006: logs AudioContext state changes', async ({ mount, page }) => {
    test.slow();
    // Set up console capture BEFORE mount so we catch creation logs
    const consoleCapture = setupConsoleCapture(page);

    // Use a controllable mock so we can manually fire statechange after mount
    await page.evaluate(() => {
      const mockCtx = {
        state: 'suspended',
        _listeners: {},
        addEventListener(type, handler) { this._listeners[type] = handler; },
        removeEventListener(type, handler) { delete this._listeners[type]; },
        resume() { return Promise.resolve(); },
        close() { this.state = 'closed'; return Promise.resolve(); },
      };
      window.AudioContext = function() { return mockCtx; };
      window.webkitAudioContext = window.AudioContext;
      // Expose so we can fire events from test
      window.mockAudioCtx = mockCtx;
    });

    const component = await mount(<VideoCall showSelfView />, { hooksConfig: baseConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Creation log should have fired
    const creationLogs = consoleCapture.matching(/\[Audio\] AudioContext created/);
    expect(creationLogs.length).toBeGreaterThanOrEqual(1);
    expect(creationLogs[0].text).toContain('suspended');

    // Fire a statechange event: suspended → running
    await page.evaluate(() => {
      window.mockAudioCtx.state = 'running';
      if (window.mockAudioCtx._listeners.statechange) {
        window.mockAudioCtx._listeners.statechange(new Event('statechange'));
      }
    });
    await page.waitForTimeout(300);

    // State change log should have fired
    const stateChangeLogs = consoleCapture.matching(/\[Audio\] AudioContext state changed/);
    expect(stateChangeLogs.length).toBeGreaterThanOrEqual(1);
    expect(stateChangeLogs[0].text).toContain('running');
  });
});
