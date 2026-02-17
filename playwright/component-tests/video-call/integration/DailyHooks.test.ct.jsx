import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { createTestRoom, cleanupTestRoom } from '../../../helpers/daily.js';
import { DailyTestWrapper } from './DailyTestWrapper';
import { HookMonitor } from './HookMonitor';

/**
 * Daily Hooks Behavior Test
 *
 * This test investigates the behavior of Daily.co hooks in the test environment.
 * Specifically: Do they return null immediately? Do they update after waiting?
 *
 * Questions to answer:
 * 1. Does useLocalSessionId() return null immediately or after a delay?
 * 2. What values do useVideoTrack/useAudioTrack return?
 * 3. Does useParticipantProperty work?
 * 4. Is this a timing issue or a fundamental incompatibility?
 */

test.describe('Daily Hooks Behavior', () => {
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

  test('investigate hook behavior over time', async ({ mount, page }) => {
    await page.context().grantPermissions(['camera', 'microphone']);

    // Mount the monitor wrapped in DailyTestWrapper
    await mount(
      <DailyTestWrapper roomUrl={room.url}>
        <HookMonitor />
      </DailyTestWrapper>
    );

    // Wait for meeting to be joined
    await page.waitForFunction(
      () => window.currentTestCall?.meetingState() === 'joined-meeting',
      { timeout: 15000 }
    );

    // Wait for all snapshots to complete (5 seconds + buffer)
    await page.waitForTimeout(6000);

    // Retrieve all snapshots
    const snapshots = await page.evaluate(() => window.dailyHookSnapshots || []);

    console.log('\n=== DAILY HOOKS INVESTIGATION ===\n');
    console.log(`Total snapshots: ${snapshots.length}`);

    // Analysis: Does useLocalSessionId ever return a value?
    const sessionIdTimeline = snapshots.map((s) => ({
      delay: s.delay,
      hookValue: s.localSessionId,
      apiValue: s.localParticipant?.session_id,
    }));

    console.log('\n--- useLocalSessionId Timeline ---');
    console.table(sessionIdTimeline);

    const hookEverReturned = snapshots.some((s) => s.localSessionId !== null);
    const apiHasSessionId = snapshots.some(
      (s) => s.localParticipant?.session_id !== null && s.localParticipant?.session_id !== undefined
    );

    console.log(`\nuseLocalSessionId ever returned a value: ${hookEverReturned}`);
    console.log(`Daily API has session_id: ${apiHasSessionId}`);

    // Analysis: Other hooks
    const videoTrackTimeline = snapshots.map((s) => ({
      delay: s.delay,
      hookState: s.videoTrack?.state || 'null',
      apiState: s.localParticipant?.videoState || 'null',
    }));

    console.log('\n--- useVideoTrack Timeline ---');
    console.table(videoTrackTimeline);

    const audioTrackTimeline = snapshots.map((s) => ({
      delay: s.delay,
      hookState: s.audioTrack?.state || 'null',
      apiState: s.localParticipant?.audioState || 'null',
    }));

    console.log('\n--- useAudioTrack Timeline ---');
    console.table(audioTrackTimeline);

    const userNameTimeline = snapshots.map((s) => ({
      delay: s.delay,
      hookValue: s.userName || 'null',
      apiValue: s.localParticipant?.user_name || 'null',
    }));

    console.log('\n--- useParticipantProperty("user_name") Timeline ---');
    console.table(userNameTimeline);

    // Assertions
    expect(snapshots.length).toBeGreaterThan(0);
    expect(apiHasSessionId).toBe(true); // Daily API should have session ID

    // The key question: Does the hook work?
    if (!hookEverReturned) {
      console.log('\n❌ ISSUE CONFIRMED: useLocalSessionId() never returns a value!');
      console.log('   Even though Daily API has session_id:', sessionIdTimeline[sessionIdTimeline.length - 1]?.apiValue);
      console.log('\n   This indicates the Daily React hooks may not work in Playwright CT environment.');
    } else {
      console.log('\n✓ useLocalSessionId() works correctly');
    }

    // Write summary
    console.log('\n=== SUMMARY ===');
    console.log('Hook vs API comparison (final snapshot):');
    const finalSnapshot = snapshots[snapshots.length - 1];
    console.log(JSON.stringify({
      'useLocalSessionId() returned': finalSnapshot.localSessionId || 'null',
      'Daily API session_id': finalSnapshot.localParticipant?.session_id || 'null',
      'useVideoTrack() state': finalSnapshot.videoTrack?.state || 'null',
      'Daily API video state': finalSnapshot.localParticipant?.videoState || 'null',
      'useAudioTrack() state': finalSnapshot.audioTrack?.state || 'null',
      'Daily API audio state': finalSnapshot.localParticipant?.audioState || 'null',
      'useParticipantProperty() userName': finalSnapshot.userName || 'null',
      'Daily API user_name': finalSnapshot.localParticipant?.user_name || 'null',
    }, null, 2));
  });

  test('investigate hook behavior with explicit session ID', async ({ mount, page }) => {
    await page.context().grantPermissions(['camera', 'microphone']);

    // Mount the monitor wrapped in DailyTestWrapper
    await mount(
      <DailyTestWrapper roomUrl={room.url}>
        <HookMonitor />
      </DailyTestWrapper>
    );

    // Wait for meeting to be joined
    await page.waitForFunction(
      () => window.currentTestCall?.meetingState() === 'joined-meeting',
      { timeout: 15000 }
    );

    // Get the actual session ID from Daily API
    const actualSessionId = await page.evaluate(
      () => window.currentTestCall?.participants()?.local?.session_id
    );

    console.log(`\nActual session ID from Daily API: ${actualSessionId}`);

    // Now remount with the explicit session ID
    await mount(
      <DailyTestWrapper roomUrl={room.url}>
        <HookMonitor sessionId={actualSessionId} />
      </DailyTestWrapper>
    );

    // Wait for snapshots
    await page.waitForTimeout(6000);

    // Check if hooks work when given explicit session ID
    const snapshots = await page.evaluate(() => window.dailyHookSnapshots || []);
    const finalSnapshot = snapshots[snapshots.length - 1];

    console.log('\n=== WITH EXPLICIT SESSION ID ===');
    console.log('Hook behavior:');
    console.log(JSON.stringify({
      'Provided session ID': actualSessionId,
      'useVideoTrack() state': finalSnapshot.videoTrack?.state || 'null',
      'useAudioTrack() state': finalSnapshot.audioTrack?.state || 'null',
      'useParticipantProperty() userName': finalSnapshot.userName || 'null',
    }, null, 2));

    // The question: If we provide the session ID manually, do the other hooks work?
    const otherHooksWork =
      finalSnapshot.videoTrack?.state === 'playable' &&
      finalSnapshot.audioTrack?.state === 'playable';

    if (otherHooksWork) {
      console.log('\n✓ Other hooks (useVideoTrack, useAudioTrack) work when given explicit session ID');
      console.log('   → This suggests useLocalSessionId is the only broken hook');
    } else {
      console.log('\n❌ Other hooks also don\'t work even with explicit session ID');
      console.log('   → This suggests a broader issue with Daily React hooks in Playwright CT');
    }
  });
});
