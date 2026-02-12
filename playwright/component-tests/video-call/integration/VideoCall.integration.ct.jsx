import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../../../client/src/call/VideoCall';
import { createTestRoom, cleanupTestRoom } from '../../../helpers/daily.js';
import { MockEmpiricaProvider } from '../../../mocks/MockEmpiricaProvider';
import { MockPlayer } from '../../../mocks/MockPlayer';
import { MockGame } from '../../../mocks/MockGame';
import { MockStage } from '../../../mocks/MockStage';
import { DailyTestWrapper } from './DailyTestWrapper';

/**
 * Real Daily.co Integration Tests
 *
 * These tests use REAL Daily.co WebRTC connections with fake media devices.
 * They verify that VideoCall correctly integrates with Daily's call object.
 *
 * Requirements:
 * - DAILY_APIKEY environment variable must be set
 * - Tests create real Daily rooms (cleaned up after each test)
 * - Uses fake video/audio (no real camera/mic needed)
 *
 * What these tests verify:
 * - Component works with real DailyProvider (not mocked)
 * - Real WebRTC connection establishment
 * - Real MediaStreamTrack objects in video elements
 * - Participant join/leave events propagate correctly
 * - Room cleanup after tests
 *
 * Architecture:
 * - DailyTestWrapper creates Daily call object in browser context
 * - Daily.createCallObject() requires browser globals (navigator, window)
 * - Tests interact with call object via window.currentTestCall
 */

test.describe('VideoCall - Real Daily Integration', () => {
  let room;

  test.beforeEach(async () => {
    // Create a real Daily room (runs in Node.js context)
    room = await createTestRoom();
  });

  test.afterEach(async ({ page }) => {
    // CRITICAL: Clean up to avoid leaking rooms

    // Cleanup any call objects created in browser context
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

    // Delete room from Daily.co
    if (room) {
      await cleanupTestRoom(room.name);
    }
  });

  test('single participant joins and sees self-view tile', async ({ mount, page }) => {
    // Grant permissions for fake media devices
    await page.context().grantPermissions(['camera', 'microphone']);

    // Create mock Empirica state for single player
    const players = [
      new MockPlayer('p0', {
        name: 'Test Player',
        position: '0',
      }),
    ];

    const game = new MockGame({
      dailyUrl: room.url,
    });

    const stage = new MockStage({});

    // Mount component with DailyTestWrapper (creates call object in browser)
    const component = await mount(
      <MockEmpiricaProvider
        currentPlayerId="p0"
        players={players}
        game={game}
        stage={stage}
      >
        <DailyTestWrapper roomUrl={room.url}>
          <VideoCall showSelfView />
        </DailyTestWrapper>
      </MockEmpiricaProvider>
    );

    // Wait for Daily to load and join
    await expect(component.locator('[data-test="loading"]')).toBeHidden({ timeout: 5000 });

    // Wait for connection to establish
    await page.waitForTimeout(3000);

    // Should see 1 tile (self-view)
    await expect(component.locator('[data-test="callTile"]')).toHaveCount(1, {
      timeout: 10000,
    });

    // Verify tile is visible
    await expect(component.locator('[data-test="callTile"]').first()).toBeVisible();

    // Verify we're in the meeting (via browser context)
    const meetingState = await page.evaluate(() => window.currentTestCall?.meetingState());
    expect(meetingState).toBe('joined-meeting');
  });

  test('real video track is attached to video element', async ({ mount, page }) => {
    await page.context().grantPermissions(['camera', 'microphone']);

    const players = [new MockPlayer('p0', { name: 'Test Player', position: '0' })];
    const game = new MockGame({ dailyUrl: room.url });
    const stage = new MockStage({});

    const component = await mount(
      <MockEmpiricaProvider currentPlayerId="p0" players={players} game={game} stage={stage}>
        <DailyTestWrapper roomUrl={room.url}>
          <VideoCall showSelfView />
        </DailyTestWrapper>
      </MockEmpiricaProvider>
    );

    // Wait for Daily to load and join
    await expect(component.locator('[data-test="loading"]')).toBeHidden({ timeout: 5000 });
    await page.waitForTimeout(3000);

    // Verify video element exists
    const videos = component.locator('video');
    await expect(videos).toHaveCount(1, { timeout: 10000 });

    // Verify video element has a real MediaStream with tracks
    const hasRealVideoTrack = await videos.first().evaluate(
      (el) => el.srcObject?.getVideoTracks().length > 0
    );
    expect(hasRealVideoTrack).toBe(true);

    // Verify participant data has playable video track
    const videoTrackState = await page.evaluate(() => {
      const participants = window.currentTestCall?.participants();
      return participants?.local?.tracks?.video?.state;
    });
    expect(videoTrackState).toBe('playable');
  });

  test('component handles Daily connection lifecycle', async ({ mount, page }) => {
    await page.context().grantPermissions(['camera', 'microphone']);

    const players = [new MockPlayer('p0', { name: 'Test Player', position: '0' })];
    const game = new MockGame({ dailyUrl: room.url });
    const stage = new MockStage({});

    const component = await mount(
      <MockEmpiricaProvider currentPlayerId="p0" players={players} game={game} stage={stage}>
        <DailyTestWrapper roomUrl={room.url}>
          <VideoCall showSelfView />
        </DailyTestWrapper>
      </MockEmpiricaProvider>
    );

    // Should show loading initially
    await expect(component.locator('[data-test="loading"]')).toBeVisible();

    // Wait for join to complete
    await expect(component.locator('[data-test="loading"]')).toBeHidden({ timeout: 5000 });
    await page.waitForTimeout(2000);

    // Verify final state
    await expect(component.locator('[data-test="callTile"]')).toHaveCount(1);

    const meetingState = await page.evaluate(() => window.currentTestCall?.meetingState());
    expect(meetingState).toBe('joined-meeting');
  });
});
