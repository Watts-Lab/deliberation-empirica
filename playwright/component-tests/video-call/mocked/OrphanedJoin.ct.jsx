import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../../../client/src/call/VideoCall';

/**
 * Component Tests for Orphaned Daily Join Race Condition (Issue #1226)
 *
 * Tests: ORPHAN-001 to ORPHAN-003
 *
 * The race condition: During Empirica stage transitions, a ~70ms desync window
 * can cause VideoCall to mount spuriously on a non-video stage. It calls
 * callObject.join(), then unmounts when the stage data resolves. But cleanup
 * skips leave() when meetingState is "joining", so the join completes orphaned
 * and the callObject is stuck in "joined-meeting" on the wrong room.
 *
 * Infrastructure:
 * - window.__mockInitialMeetingState: set BEFORE mount to override initial state
 * - window.__mockJoinBehavior: 'delayed' makes join() return a manually-resolvable promise
 * - window.mockCallObject._resolveJoin(): resolve the pending delayed join
 * - window.mockCallObject._leaveCalls: array of leave() call logs
 */

const baseConfig = {
  empirica: {
    currentPlayerId: 'p0',
    players: [{ id: 'p0', attrs: { position: '0', dailyId: 'daily-p0', name: 'Test User' } }],
    game: { attrs: { dailyUrl: 'https://test.daily.co/room-a' } },
    stage: { attrs: {}, id: 'stage-1' },
    stageTimer: { elapsed: 0 },
  },
  daily: {
    localSessionId: 'daily-p0',
    participantIds: ['daily-p0'],
    videoTracks: { 'daily-p0': { isOff: false, subscribed: true } },
    audioTracks: { 'daily-p0': { isOff: false, subscribed: true } },
  },
};

test.describe('Orphaned Join Cleanup (useCallLifecycle)', () => {
  /**
   * ORPHAN-001: When component unmounts during "joining" state, leave() must be
   * called after the join completes.
   *
   * This is the core bug from issue #1226:
   * 1. VideoCall mounts spuriously during stage desync window
   * 2. callObject.join() starts (meetingState → "joining")
   * 3. Component unmounts when stage data resolves (not a video stage)
   * 4. Cleanup sees "joining" and skips leave()  ← BUG
   * 5. Join completes → callObject stuck in "joined-meeting" on wrong room
   *
   * Expected: cleanup arranges for leave() after the pending join resolves.
   *
   * STATUS: RED test — fails with current code, passes after fix.
   */
  test('ORPHAN-001: leave() called after orphaned join completes on unmount', async ({ mount, page }) => {
    // Setup: delayed join so we can unmount while "joining"
    await page.evaluate(() => {
      window.__mockInitialMeetingState = 'new';
      window.__mockJoinBehavior = 'delayed';
    });

    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: baseConfig,
    });

    // Wait for join to start (state should transition to 'joining')
    await expect(async () => {
      const state = await page.evaluate(() => window.mockCallObject?.meetingState());
      expect(state).toBe('joining');
    }).toPass({ timeout: 3000 });

    // Save reference to mock before unmount (provider cleanup deletes window.mockCallObject)
    await page.evaluate(() => {
      window._savedMock = window.mockCallObject;
    });

    // Verify no leave() calls yet
    const leavesBefore = await page.evaluate(() => window._savedMock._leaveCalls.length);
    expect(leavesBefore).toBe(0);

    // Unmount while join is in progress — this is the critical moment.
    // Current behavior: cleanup sees "joining", skips leave() → BUG
    // Fixed behavior: cleanup arranges for leave() after join resolves
    await component.unmount();

    // Resolve the pending join (simulates Daily SDK completing the join)
    await page.evaluate(() => window._savedMock._resolveJoin());

    // Give the post-join cleanup a tick to run
    await page.waitForTimeout(100);

    // Verify leave() was called after the orphaned join completed
    const leaveCalls = await page.evaluate(() => window._savedMock._leaveCalls);
    expect(leaveCalls.length).toBeGreaterThanOrEqual(1);
  });

  /**
   * ORPHAN-002: Normal unmount from "joined-meeting" calls leave() immediately.
   *
   * Regression test: existing cleanup behavior must not break.
   */
  test('ORPHAN-002: normal cleanup calls leave() when joined', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: baseConfig,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Save reference before unmount
    await page.evaluate(() => {
      window._savedMock = window.mockCallObject;
    });

    // Unmount — cleanup should call leave() since state is "joined-meeting"
    await component.unmount();

    const leaveCalls = await page.evaluate(() => window._savedMock._leaveCalls);
    expect(leaveCalls.length).toBeGreaterThanOrEqual(1);
    expect(leaveCalls[0].fromState).toBe('joined-meeting');
  });

  /**
   * ORPHAN-003: joinRoom skips when callObject is already in "joined-meeting".
   *
   * Existing guard behavior — join() should NOT be called redundantly.
   */
  test('ORPHAN-003: joinRoom skips when already joined', async ({ mount, page }) => {
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: baseConfig,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Mock starts in "joined-meeting" — joinRoom() should have skipped join()
    const joinCalled = await page.evaluate(() => window.mockCallObject._joinCalled);
    expect(joinCalled).toBe(false);
  });
});
