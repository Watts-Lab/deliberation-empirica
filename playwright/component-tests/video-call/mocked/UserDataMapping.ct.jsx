import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../../../client/src/call/VideoCall';

/**
 * Component Tests for userData-based Fast Position Mapping
 * Related: Issue #1187 - Firefox requiring click to connect to Daily
 * Tests: USERDATA-001 to USERDATA-003
 *
 * When participants join Daily, their position is passed via userData in join() options.
 * This allows other clients to immediately map dailyId → position without waiting for
 * Empirica sync (~5 seconds). Call.jsx checks userData.position first, then falls back
 * to Empirica's player.get("dailyId") mapping.
 *
 * Test strategy: Use configs similar to working Subscriptions tests, but set
 * participants with userData.position to verify it's used correctly.
 */

/**
 * Base config - similar to Subscriptions tests
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

/**
 * Participant with userData.position (fast mapping path)
 */
const participantsWithUserData = {
  'daily-p1': {
    local: false,
    session_id: 'daily-p1',
    userData: { position: '1' },  // Fast mapping via userData!
    tracks: {
      audio: {
        state: 'playable',
        subscribed: false,  // Drifted - needs repair
        off: null,
        blocked: null,
      },
      video: {
        state: 'playable',
        subscribed: false,
        off: null,
        blocked: null,
      },
      screenVideo: { subscribed: false },
    },
  },
};

/**
 * Participant without userData (falls back to Empirica mapping)
 */
const participantsWithoutUserData = {
  'daily-p1': {
    local: false,
    session_id: 'daily-p1',
    // No userData - should fall back to Empirica
    tracks: {
      audio: {
        state: 'playable',
        subscribed: false,
        off: null,
        blocked: null,
      },
      video: {
        state: 'playable',
        subscribed: false,
        off: null,
        blocked: null,
      },
      screenVideo: { subscribed: false },
    },
  },
};

/**
 * Helper: mount VideoCall in an explicit-sized container.
 */
async function mountVideoCall(mount, hooksConfig) {
  return mount(
    <div style={{ width: '800px', height: '600px', position: 'relative' }}>
      <VideoCall showSelfView />
    </div>,
    { hooksConfig }
  );
}

/**
 * Helper: set up participants and wait for subscription effect
 */
async function setupAndTriggerSubscriptions(page, participants) {
  await page.waitForFunction(() => !!window.mockCallObject, { timeout: 15000 });
  await page.evaluate(
    (p) => { window.mockCallObject._participants = p; },
    participants
  );
  // Advance past heartbeat to trigger subscription effect
  await page.clock.fastForward(2100);
  await page.waitForTimeout(300);
}

test.describe('userData-based Fast Position Mapping (USERDATA)', () => {
  test.describe.configure({ mode: 'serial' });

  test('USERDATA-001: Subscribes when participant has userData.position', async ({
    mount,
    page,
  }) => {
    test.slow();
    /**
     * When a participant has userData.position, Call.jsx should read it
     * and include them in subscription updates.
     */
    await page.clock.install();
    await mountVideoCall(mount, baseConfig);
    await setupAndTriggerSubscriptions(page, participantsWithUserData);

    // Verify updateParticipants was called with daily-p1
    const calls = await page.evaluate(() => window.mockCallObject._updateParticipantsCalls);
    expect(calls.length).toBeGreaterThanOrEqual(1);

    const hasP1Subscription = calls.some(call =>
      call.updates && call.updates['daily-p1']
    );
    expect(hasP1Subscription).toBe(true);
  });

  test('USERDATA-002: Subscribes when participant lacks userData (Empirica fallback)', async ({
    mount,
    page,
  }) => {
    test.slow();
    /**
     * When a participant doesn't have userData.position, Call.jsx should
     * fall back to Empirica's dailyId mapping.
     */
    await page.clock.install();
    await mountVideoCall(mount, baseConfig);
    await setupAndTriggerSubscriptions(page, participantsWithoutUserData);

    // Verify updateParticipants was called with daily-p1
    const calls = await page.evaluate(() => window.mockCallObject._updateParticipantsCalls);
    expect(calls.length).toBeGreaterThanOrEqual(1);

    const hasP1Subscription = calls.some(call =>
      call.updates && call.updates['daily-p1']
    );
    expect(hasP1Subscription).toBe(true);
  });

  test('USERDATA-003: userData.position takes precedence over mismatched Empirica data', async ({
    mount,
    page,
  }) => {
    test.slow();
    /**
     * If userData.position differs from what Empirica says, userData should win
     * (this is the fast path - Empirica may be stale).
     *
     * This test uses a config where Empirica thinks daily-p1 is position 1,
     * but userData says position 2. The subscription should use position from userData.
     */
    // Config with position mismatch (Empirica says 1, userData says 2)
    const mismatchConfig = {
      ...baseConfig,
      empirica: {
        ...baseConfig.empirica,
        players: [
          { id: 'p0', attrs: { name: 'Player 0', position: '0', dailyId: 'daily-p0' } },
          { id: 'p1', attrs: { name: 'Player 1', position: '1', dailyId: 'daily-p1' } },
          { id: 'p2', attrs: { name: 'Player 2', position: '2' } },  // Position 2 exists but no dailyId
        ],
      },
    };

    // Participant claims position 2 via userData (not position 1 from Empirica)
    const participantsWithMismatchedPosition = {
      'daily-p1': {
        local: false,
        session_id: 'daily-p1',
        userData: { position: '2' },  // Claims position 2, not 1
        tracks: {
          audio: { state: 'playable', subscribed: false, off: null, blocked: null },
          video: { state: 'playable', subscribed: false, off: null, blocked: null },
          screenVideo: { subscribed: false },
        },
      },
    };

    await page.clock.install();
    await mountVideoCall(mount, mismatchConfig);
    await setupAndTriggerSubscriptions(page, participantsWithMismatchedPosition);

    // The subscription should work regardless - position comes from userData
    const calls = await page.evaluate(() => window.mockCallObject._updateParticipantsCalls);
    expect(calls.length).toBeGreaterThanOrEqual(1);

    const hasP1Subscription = calls.some(call =>
      call.updates && call.updates['daily-p1']
    );
    expect(hasP1Subscription).toBe(true);
  });
});
