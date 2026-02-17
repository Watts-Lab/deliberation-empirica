import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../../../client/src/call/VideoCall';
import { setupConsoleCapture } from '../../../mocks/console-capture.js';

/**
 * Component Tests for Subscription Reliability
 * Related: Call.jsx subscription heartbeat (setInterval 2000ms) and repair logic
 * Tests: SUB-001 to SUB-006
 *
 * Strategy:
 * - page.clock.install() BEFORE mount patches setInterval in the browser, so the
 *   2-second heartbeat registered at mount time uses the fake clock.
 * - page.clock.fastForward(2100) advances to t=2100ms, firing the interval at t=2000ms.
 * - window.mockCallObject._participants provides "actual" subscription state that
 *   Call.jsx reads via callObject.participants().
 * - window.mockCallObject._updateParticipantsCalls records all updateParticipants calls.
 *
 * The repair condition (from Call.jsx):
 *   wantAudioButNotSubscribed = desired.audio && audioTrack.state && !audioTrack.subscribed
 *   → If layout wants audio for p1 but p1.tracks.audio.subscribed=false AND state is
 *     truthy (track exists) → drift detected → updateParticipants called.
 *
 * Container dimensions: VideoCall uses h-full, so we wrap in an explicit-sized div
 * to ensure Call's containerRef gets non-zero dimensions → myLayout is computed.
 * Without non-zero dimensions, the subscription effect returns early (myLayout=null).
 */

const subTestConfig = {
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
 * Drift state: layout wants audio subscribed for p1, but actual state shows unsubscribed.
 * audio.state='playable' means the track exists and is subscribable.
 * audio.subscribed=false means Daily hasn't subscribed yet → drift!
 */
const driftedParticipants = {
  'daily-p1': {
    local: false,
    tracks: {
      audio: {
        state: 'playable',  // track exists — subscribable
        subscribed: false,  // not yet subscribed — drift!
        off: null,
        blocked: null,
      },
      video: {
        state: 'playable',
        subscribed: true,   // video is fine
        off: null,
        blocked: null,
      },
      screenVideo: { subscribed: false },
    },
  },
};

/**
 * Unsubscribable state: audio.state=null means no track from remote → can't subscribe.
 * The repair logic skips tracks where audioSubscribable is falsy.
 */
const unsubscribableParticipants = {
  'daily-p1': {
    local: false,
    tracks: {
      audio: {
        state: null,       // no track → NOT subscribable
        subscribed: false,
        off: null,
        blocked: null,
      },
      video: {
        state: null,       // no video track either
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
 *
 * The container provides non-zero dimensions so Call.jsx's containerRef
 * (via getBoundingClientRect) returns width=800, height=600, allowing
 * myLayout to be computed (it returns null when width===0 || height===0).
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
 * Helper: wait for mockCallObject and set drifted _participants.
 * Returns when the drift state is in place and ready for clock advancement.
 */
async function setupDrift(page, participants) {
  await page.waitForFunction(() => !!window.mockCallObject, { timeout: 15000 });
  await page.evaluate(
    (participantsArg) => { window.mockCallObject._participants = participantsArg; },
    participants
  );
}

test.describe('Subscription Reliability (SUB)', () => {
  test.describe.configure({ mode: 'serial' });

  /**
   * SUB-001: Detects subscription drift and calls updateParticipants
   *
   * When the layout requires audio for p1 but callObject.participants() shows
   * p1.audio.subscribed=false (with a subscribable state), the heartbeat must
   * trigger updateParticipants to repair the drift.
   */
  test('SUB-001: detects subscription drift and calls updateParticipants', async ({ mount, page }) => {
    test.slow();

    // Install fake clock BEFORE mount so the heartbeat setInterval uses it
    await page.clock.install();

    await mountVideoCall(mount, subTestConfig);
    await setupDrift(page, driftedParticipants);

    // Advance past one heartbeat interval (2000ms) — triggers recheckCount++
    // which re-runs the subscription effect with the drifted _participants
    await page.clock.fastForward(2100);
    await page.waitForTimeout(300); // Allow React to re-render and run the effect

    const callCount = await page.evaluate(() => window.mockCallObject._updateParticipantsCalls.length);
    expect(callCount).toBeGreaterThanOrEqual(1);
  });

  /**
   * SUB-002: Repair sends the correct setSubscribedTracks payload
   *
   * The updateParticipants call must include setSubscribedTracks.audio=true for p1,
   * matching what the layout expects (audio: true, video: true, screenVideo: false).
   */
  test('SUB-002: repair sends correct setSubscribedTracks payload', async ({ mount, page }) => {
    test.slow();

    await page.clock.install();
    await mountVideoCall(mount, subTestConfig);
    await setupDrift(page, driftedParticipants);

    await page.clock.fastForward(2100);
    await page.waitForTimeout(300);

    const calls = await page.evaluate(() => window.mockCallObject._updateParticipantsCalls);
    expect(calls.length).toBeGreaterThanOrEqual(1);

    const lastCall = calls[calls.length - 1];
    expect(lastCall.updates['daily-p1']).toBeDefined();
    expect(lastCall.updates['daily-p1'].setSubscribedTracks).toBeDefined();
    // Layout wants audio=true for p1 (they are in the remote feed)
    expect(lastCall.updates['daily-p1'].setSubscribedTracks.audio).toBe(true);
  });

  /**
   * SUB-003: Heartbeat triggers repair console log
   *
   * Call.jsx logs "[Subscription] Applying updates:" when a repair is dispatched.
   * This log must appear after the heartbeat fires and drift is detected.
   */
  test('SUB-003: heartbeat triggers repair console log', async ({ mount, page }) => {
    test.slow();

    const consoleCapture = setupConsoleCapture(page);

    await page.clock.install();
    await mountVideoCall(mount, subTestConfig);
    await setupDrift(page, driftedParticipants);

    await page.clock.fastForward(2100);
    await page.waitForTimeout(300);

    const repairLogs = consoleCapture.matching(/\[Subscription\] Applying updates:/);
    expect(repairLogs.length).toBeGreaterThanOrEqual(1);
  });

  /**
   * SUB-004: Cooldown prevents rapid re-repair (REPAIR_COOLDOWN_MS = 3000ms)
   *
   * Repairs triggered by the subscription heartbeat must be spaced at least
   * REPAIR_COOLDOWN_MS=3000ms apart. This protects Daily from rapid-fire updates.
   *
   * Implementation note: the fake clock (page.clock.install) auto-advances with real
   * time, AND the subscription effect can be triggered early by React re-renders from
   * state changes (AudioContext monitor, ResizeObserver, etc.) after _participants is
   * set. So we test the OBSERVABLE property: consecutive repair timestamps must be
   * >= 3000ms apart, regardless of what triggered each repair.
   *
   * Test strategy: advance through multiple heartbeat intervals and verify that any
   * consecutive repairs are separated by at least the cooldown period.
   */
  test('SUB-004: consecutive repairs are spaced >= 3000ms apart (cooldown enforced)', async ({ mount, page }) => {
    test.slow();

    await page.clock.install();
    await mountVideoCall(mount, subTestConfig);
    await setupDrift(page, driftedParticipants);

    // Allow time for at least 2 repair cycles:
    // - First repair: triggered shortly after drift is set (by any subscription effect run)
    // - Cooldown: 3000ms before next repair is allowed
    // - Second repair: happens after cooldown expires
    // fastForward(5100) adds 5100ms + real elapsed time → well past 2 cooldown cycles
    await page.clock.fastForward(5100);
    await page.waitForTimeout(500);

    const calls = await page.evaluate(() => window.mockCallObject._updateParticipantsCalls);

    // At least one repair must have happened (drift was detected)
    expect(calls.length).toBeGreaterThanOrEqual(1);

    // Key assertion: each consecutive pair of repairs must be spaced >= 3000ms.
    // If cooldown were broken, all repairs would be ~2000ms apart (one per heartbeat).
    for (let i = 1; i < calls.length; i++) {
      const gap = calls[i].timestamp - calls[i - 1].timestamp;
      expect(gap).toBeGreaterThanOrEqual(3000);
    }
  });

  /**
   * SUB-005: Does not try to subscribe to unsubscribable tracks
   *
   * When audio.state=null (remote is not sending the track), subscribing would fail.
   * The repair logic skips: wantAudioButNotSubscribed requires audioSubscribable to be truthy.
   * audioSubscribable = audioTrack && audioTrack.state = {...} && null = null → falsy → skip.
   */
  test('SUB-005: does not repair when track state is null (not subscribable)', async ({ mount, page }) => {
    test.slow();

    await page.clock.install();
    await mountVideoCall(mount, subTestConfig);
    await setupDrift(page, unsubscribableParticipants);

    await page.clock.fastForward(2100);
    await page.waitForTimeout(300);

    const callCount = await page.evaluate(() => window.mockCallObject._updateParticipantsCalls.length);
    // No repair: track is not subscribable (state=null)
    expect(callCount).toBe(0);
  });

  /**
   * SUB-006: Logs repair events with participant IDs
   *
   * The "[Subscription] Applying updates:" log must contain the target participant ID
   * so engineers can trace which participant's subscriptions were repaired.
   */
  test('SUB-006: repair log includes the target participant ID', async ({ mount, page }) => {
    test.slow();

    const consoleCapture = setupConsoleCapture(page);

    await page.clock.install();
    await mountVideoCall(mount, subTestConfig);
    await setupDrift(page, driftedParticipants);

    await page.clock.fastForward(2100);
    await page.waitForTimeout(300);

    const repairLogs = consoleCapture.matching(/\[Subscription\] Applying updates:/);
    expect(repairLogs.length).toBeGreaterThanOrEqual(1);
    // Log includes the participant ID being repaired
    expect(repairLogs[0].text).toContain('daily-p1');
  });
});
