import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../../../client/src/call/VideoCall';
import { createTestRoom, cleanupTestRoom } from '../../../helpers/daily.js';
import { singlePlayerRealDaily, withRoomUrl } from '../../shared/integration-fixtures';

/**
 * Simple test: Does VideoCall component see useLocalSessionId() value?
 *
 * This test checks if the Daily hooks work when VideoCall is wrapped in both
 * MockEmpiricaProvider AND DailyTestWrapper (via hooksConfig pattern).
 *
 * Hypothesis: The hooks work in isolation (confirmed by DailyHooks.test.ct.jsx),
 * but may not work when combined with MockEmpiricaProvider.
 */

async function waitForJoinedMeeting(page, timeoutMs = 15000) {
  const startTime = Date.now();
  // eslint-disable-next-line no-await-in-loop
  while (Date.now() - startTime < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    const meetingState = await page.evaluate(() => window.currentTestCall?.meetingState());
    if (meetingState === 'joined-meeting') {
      return true;
    }
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(500);
  }
  throw new Error(`Timed out waiting for joined-meeting state after ${timeoutMs}ms`);
}

test.describe('VideoCall Hook Investigation', () => {
  let room;

  test.beforeEach(async () => {
    room = await createTestRoom();
  });

  test.afterEach(async ({ page }) => {
    // Cleanup call objects
    await page.evaluate(() => {
      if (window.testCallObjects) {
        window.testCallObjects.forEach(async (call) => {
          try {
            if (call.meetingState() !== 'left-meeting') {
              await call.leave();
            }
            await call.destroy();
          } catch (e) {
            console.warn('Error cleaning up call:', e);
          }
        });
        window.testCallObjects = [];
      }
    });

    if (room) {
      await cleanupTestRoom(room.name);
    }
  });

  test('check what useLocalSessionId returns inside VideoCall', async ({ mount, page }) => {
    await page.context().grantPermissions(['camera', 'microphone']);

    const config = withRoomUrl(singlePlayerRealDaily, room.url);

    // Add instrumentation to window before mounting
    await page.evaluate(() => {
      // Store hook values as they're called
      window.hookCallLog = [];

      // Monkey-patch console.log to capture VideoCall's logging
      const originalLog = console.log;
      console.log = (...args) => {
        window.hookCallLog.push({ type: 'log', args: args.map(String) });
        originalLog(...args);
      };
    });

    // Mount VideoCall with both providers via hooksConfig
    await mount(<VideoCall showSelfView />, {
      hooksConfig: config,
    });

    // Wait for Daily call to join
    await waitForJoinedMeeting(page);

    // Wait for hooks to settle
    await page.waitForTimeout(3000);

    // Check what the player has
    const playerState = await page.evaluate(() => {
      const ctx = window.mockEmpiricaContext;
      const player = ctx?.players?.[0];
      return {
        playerId: player?.id,
        playerDailyId: player?.get?.('dailyId'),
        playerHasSetMethod: typeof player?.set === 'function',
        playerPosition: player?.get?.('position'),
      };
    });

    console.log('\n=== Player State ===');
    console.log(JSON.stringify(playerState, null, 2));

    // Check what Daily API has
    const dailyState = await page.evaluate(() => {
      const call = window.currentTestCall;
      const participants = call?.participants();
      const local = participants?.local;
      return {
        meetingState: call?.meetingState(),
        localSessionId: local?.session_id,
        localUserName: local?.user_name,
        videoState: local?.tracks?.video?.state,
        audioState: local?.tracks?.audio?.state,
      };
    });

    console.log('\n=== Daily API State ===');
    console.log(JSON.stringify(dailyState, null, 2));

    // The question: Did player.set("dailyId", ...) ever get called?
    const setCalls = await page.evaluate(() => {
      const ctx = window.mockEmpiricaContext;
      const player = ctx?.players?.[0];
      return player?.getAllSetCalls?.() || [];
    });

    console.log('\n=== Player.set() Calls ===');
    console.log(JSON.stringify(setCalls, null, 2));

    // Analysis
    const dailyIdWasSet = setCalls.some((call) => call.key === 'dailyId');

    console.log('\n=== ANALYSIS ===');
    console.log(`Daily API has session ID: ${!!dailyState.localSessionId}`);
    console.log(`Player has dailyId: ${!!playerState.playerDailyId}`);
    console.log(`player.set("dailyId", ...) was called: ${dailyIdWasSet}`);

    if (dailyState.localSessionId && !playerState.playerDailyId) {
      console.log('\n❌ ISSUE: Daily has session ID but player.dailyId is null!');
      console.log('   This means useLocalSessionId() returned null inside VideoCall');
    } else if (dailyState.localSessionId && playerState.playerDailyId) {
      console.log('\n✓ SUCCESS: Daily session ID was propagated to player.dailyId');
      expect(playerState.playerDailyId).toBe(dailyState.localSessionId);
    }

    // Verify that player.set works
    expect(playerState.playerHasSetMethod).toBe(true);

    // Verify Daily API works
    expect(dailyState.meetingState).toBe('joined-meeting');
    expect(dailyState.localSessionId).toBeTruthy();
  });
});
