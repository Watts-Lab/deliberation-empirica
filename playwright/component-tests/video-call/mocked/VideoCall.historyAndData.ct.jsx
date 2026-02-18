import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../../../client/src/call/VideoCall';

/**
 * Component Tests for DailyId History Logging and Player Data
 *
 * Related: PR #1173 (DailyId history), PR #1171 (avReports)
 * Tests: HISTORY-001 to HISTORY-004, PDATA-001, PDATA-002
 *
 * These tests verify that VideoCall correctly logs:
 * 1. DailyId history entries on join (HISTORY-*)
 * 2. A/V report data in player attributes (PDATA-*)
 *
 * We access player state via window.mockPlayers (exposed by MockEmpiricaProvider).
 * The mock callObject returns 'joined-meeting' by default, which triggers
 * logDailyIdHistory() immediately on mount.
 */

const connectedConfig = {
  empirica: {
    currentPlayerId: 'p0',
    players: [{
      id: 'p0',
      attrs: {
        position: '0',
        dailyId: 'daily-p0',
        name: 'Test User',
      },
    }],
    game: { attrs: { dailyUrl: 'https://test.daily.co/room' } },
    stage: { attrs: {} },
    stageTimer: { elapsed: 30000 },
    progressLabel: 'game_0_discussion',
  },
  daily: {
    localSessionId: 'daily-p0',
    participantIds: ['daily-p0'],
    videoTracks: { 'daily-p0': { isOff: false, subscribed: true } },
    audioTracks: { 'daily-p0': { isOff: false, subscribed: true } },
  },
};

const twoPlayerConfig = {
  empirica: {
    currentPlayerId: 'p0',
    players: [
      { id: 'p0', attrs: { name: 'Player 0', position: '0', dailyId: 'daily-p0' } },
      { id: 'p1', attrs: { name: 'Player 1', position: '1', dailyId: 'daily-p1' } },
    ],
    game: { attrs: {} },  // No dailyUrl - skips join effect to avoid stall detection timers
    stage: { attrs: {} },
    stageTimer: { elapsed: 0 },
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

test.describe('DailyId History Logging', () => {
  test.describe.configure({ mode: 'serial' });

  /**
   * HISTORY-001: Logs dailyId on join
   * Validates: player.append("dailyIdHistory") is called when VideoCall mounts
   * and callObject.meetingState() returns 'joined-meeting'
   */
  test('HISTORY-001: logs dailyId on join', async ({ mount, page }) => {
    test.slow();
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Wait for effects to run and check player data
    const appendCalls = await page.evaluate(() => {
      const players = window.mockPlayers;
      if (!players || players.length === 0) return null;
      return players[0].getAppendCalls('dailyIdHistory');
    });

    expect(appendCalls).not.toBeNull();
    expect(appendCalls.length).toBeGreaterThanOrEqual(1);
    expect(appendCalls[0].value.dailyId).toBe('daily-p0');
  });

  /**
   * HISTORY-002: Entry includes timestamp
   * Validates: DailyId history entry has a timestamp field
   */
  test('HISTORY-002: history entry includes timestamp', async ({ mount, page }) => {
    test.slow();
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    const history = await page.evaluate(() => {
      const players = window.mockPlayers;
      if (!players || players.length === 0) return null;
      return players[0].getAppendCalls('dailyIdHistory');
    });

    expect(history).not.toBeNull();
    expect(history.length).toBeGreaterThanOrEqual(1);

    const entry = history[0].value;
    expect(entry).toHaveProperty('timestamp');
    // Timestamp should be a valid ISO date string
    expect(() => new Date(entry.timestamp)).not.toThrow();
    expect(new Date(entry.timestamp).getTime()).toBeGreaterThan(0);
  });

  /**
   * HISTORY-003: Entry includes progressLabel
   * Validates: DailyId history entry has progressLabel from stage context
   */
  test('HISTORY-003: history entry includes progressLabel', async ({ mount, page }) => {
    test.slow();
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    const history = await page.evaluate(() => {
      const players = window.mockPlayers;
      if (!players || players.length === 0) return null;
      return players[0].getAppendCalls('dailyIdHistory');
    });

    expect(history).not.toBeNull();
    expect(history.length).toBeGreaterThanOrEqual(1);

    const entry = history[0].value;
    expect(entry).toHaveProperty('dailyId');
    expect(entry).toHaveProperty('progressLabel');
    expect(entry).toHaveProperty('stageElapsed');
    expect(entry).toHaveProperty('timestamp');
  });

  /**
   * HISTORY-004: Multiple entries when Daily session ID changes
   * Validates: A new history entry is logged when the participant's Daily session ID
   * changes (e.g., after a network drop and reconnect within the same stage).
   *
   * The deduplication check (dailyId + progressLabel) must allow a new entry
   * when the dailyId differs from the last logged entry.
   *
   * Implementation: window.mockDailySetLocalSessionId() is exposed by MockDailyProvider
   * to allow mid-test session ID updates without re-mounting.
   */
  test('HISTORY-004: logs new entry when Daily session ID changes', async ({ mount, page }) => {
    test.slow();
    const component = await mount(<VideoCall showSelfView />, { hooksConfig: connectedConfig });
    await expect(component).toBeVisible({ timeout: 15000 });

    // First entry should be logged on mount
    const firstHistory = await page.evaluate(() => {
      const players = window.mockPlayers;
      if (!players || players.length === 0) return null;
      return players[0].getAppendCalls('dailyIdHistory');
    });
    expect(firstHistory).not.toBeNull();
    expect(firstHistory.length).toBeGreaterThanOrEqual(1);
    expect(firstHistory[0].value.dailyId).toBe('daily-p0');

    // Simulate participant reconnecting with a new Daily session ID
    // (e.g., network drop, participant rejoin, or race condition recovery)
    await page.evaluate(() => {
      if (window.mockDailySetLocalSessionId) {
        window.mockDailySetLocalSessionId('daily-p0-reconnected');
      }
    });

    // Wait for React to re-render and the history effect to re-run
    await page.waitForTimeout(500);

    // Second entry should now exist with the new session ID
    const updatedHistory = await page.evaluate(() => {
      const players = window.mockPlayers;
      if (!players || players.length === 0) return null;
      return players[0].getAppendCalls('dailyIdHistory');
    });

    expect(updatedHistory).not.toBeNull();
    expect(updatedHistory.length).toBeGreaterThanOrEqual(2);
    expect(updatedHistory[1].value.dailyId).toBe('daily-p0-reconnected');
  });
});

test.describe('Player Data Logging (avReports)', () => {
  test.describe.configure({ mode: 'serial' });

  /**
   * PDATA-001: avReports array populated
   * Validates: player.append("avReports") called after completing Fix A/V flow
   *
   * Uses VideoCall (not Tray directly) because VideoCall calls usePlayer() internally
   * and passes the connected player to Tray. With player: null in Tray, avReports
   * is skipped in the if (player) guard.
   */
  test('PDATA-001: avReports populated after Fix A/V diagnosis', async ({ mount, page }) => {
    test.slow();

    // Mock AudioContext and document.hasFocus to prevent overlays in headless browser
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
      // Mock document.hasFocus to return true (prevents joinStalled overlay)
      document.hasFocus = () => true;
    });

    const component = await mount(<VideoCall showSelfView showReportMissing />, {
      hooksConfig: twoPlayerConfig
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Wait for any stall-detection overlay to disappear (appears briefly in headless due to hasFocus=false)
    await expect(page.locator('.fixed.inset-0')).not.toBeVisible({ timeout: 5000 });

    // Click the Fix A/V button in the Tray (rendered by VideoCall)
    await page.locator('[data-test="fixAV"]').click();
    await expect(page.locator('text=What problems are you experiencing?')).toBeVisible({ timeout: 5000 });

    // Select an issue
    await page.locator("text=Others can't hear me").click();
    await expect(page.locator('input[value="others-cant-hear-me"]')).toBeChecked();

    // Click Diagnose & Fix
    await page.locator('button:has-text("Diagnose & Fix")').click();

    // Wait for diagnosis to show loading state
    await expect(page.locator('text=Attempting to fix...')).toBeVisible({ timeout: 5000 });

    // Wait for diagnosing to complete (built-in 1s wait + diagnosis time)
    await expect(page.locator('text=Attempting to fix...')).not.toBeVisible({ timeout: 10000 });

    // Check that avReports was populated
    const avReports = await page.evaluate(() => {
      const players = window.mockPlayers;
      if (!players || players.length === 0) return null;
      return players[0].getAppendCalls('avReports');
    });

    expect(avReports).not.toBeNull();
    expect(avReports.length).toBeGreaterThanOrEqual(1);
  });

  /**
   * PDATA-002: Report includes all required fields
   * Validates: avReports entry has issues, stage, timestamp, avIssueId, etc.
   */
  test('PDATA-002: avReport entry includes required fields', async ({ mount, page }) => {
    test.slow();

    // Mock AudioContext and document.hasFocus to prevent overlays in headless browser
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
      // Mock document.hasFocus to return true (prevents joinStalled overlay)
      document.hasFocus = () => true;
    });

    const component = await mount(<VideoCall showSelfView showReportMissing />, {
      hooksConfig: twoPlayerConfig
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Wait for component to fully initialize (effects to complete)
    await page.waitForTimeout(1000);

    // Open modal, select issue, diagnose
    await page.locator('[data-test="fixAV"]').click();
    await expect(page.locator('text=What problems are you experiencing?')).toBeVisible({ timeout: 5000 });
    await page.locator("text=Others can't hear me").click();
    await page.locator('button:has-text("Diagnose & Fix")').click();

    // Wait for diagnosis to complete
    await expect(page.locator('text=Attempting to fix...')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Attempting to fix...')).not.toBeVisible({ timeout: 10000 });

    // Check avReports fields
    const avReports = await page.evaluate(() => {
      const players = window.mockPlayers;
      if (!players || players.length === 0) return null;
      return players[0].getAppendCalls('avReports');
    });

    expect(avReports).not.toBeNull();
    expect(avReports.length).toBeGreaterThanOrEqual(1);

    const report = avReports[0].value;
    // Required fields from FixAV.jsx line 390+
    expect(report).toHaveProperty('issues');
    expect(report).toHaveProperty('stage');
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('avIssueId');
    expect(report).toHaveProperty('audioContextState');
    expect(report).toHaveProperty('meetingState');
    expect(report).toHaveProperty('recoveryStatus');

    // Issues should include what we selected
    expect(report.issues).toContain('others-cant-hear-me');
  });
});
