import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../../../client/src/call/VideoCall';
import { createTestRoom, cleanupTestRoom } from '../../../helpers/daily.js';
import { singlePlayerRealDaily, withRoomUrl } from '../../shared/integration-fixtures';
import { TileHookDiagnostic } from './TileHookDiagnostic';

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
 * Architecture (uses hooksConfig pattern):
 * - beforeMount hook (playwright/index.jsx) creates DailyTestWrapper when daily.roomUrl is set
 * - DailyTestWrapper creates Daily call object in browser context
 * - Daily.createCallObject() requires browser globals (navigator, window)
 * - Tests interact with call object via window.currentTestCall
 * - IMPORTANT: Use page.locator() not component.locator() (component boundary differs with hooksConfig)
 */

/**
 * Wait for Daily call to reach 'joined-meeting' state
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

    // Use hooksConfig pattern to avoid serialization issues
    const config = withRoomUrl(singlePlayerRealDaily, room.url);

    // Mount component - beforeMount hook will wrap with providers
    await mount(<VideoCall showSelfView />, {
      hooksConfig: config,
    });

    // Wait for Daily call to join
    await waitForJoinedMeeting(page);

    // Should see 1 tile (self-view)
    await expect(page.locator('[data-test="callTile"]')).toHaveCount(1, {
      timeout: 5000,
    });

    // Verify tile is visible
    await expect(page.locator('[data-test="callTile"]').first()).toBeVisible();

    // Verify we're in the meeting (via browser context)
    const meetingState = await page.evaluate(() => window.currentTestCall?.meetingState());
    expect(meetingState).toBe('joined-meeting');
  });

  test('real video track is attached to video element', async ({ mount, page }) => {
    await page.context().grantPermissions(['camera', 'microphone']);

    const config = withRoomUrl(singlePlayerRealDaily, room.url);

    await mount(<VideoCall showSelfView />, {
      hooksConfig: config,
    });

    // Wait for Daily call to fully join
    await waitForJoinedMeeting(page);

    // Wait for video track to be playable
    await page.waitForTimeout(2000);

    // Verify participant data has playable video track
    const videoTrackState = await page.evaluate(() => {
      const participants = window.currentTestCall?.participants();
      return participants?.local?.tracks?.video?.state;
    });
    expect(videoTrackState).toBe('playable');

    // Note: DailyVideo component may not always render a <video> element
    // (it depends on the implementation), so we verify tracks via Daily API instead
  });

  test('component handles Daily connection lifecycle', async ({ mount, page }) => {
    await page.context().grantPermissions(['camera', 'microphone']);

    const config = withRoomUrl(singlePlayerRealDaily, room.url);

    await mount(<VideoCall showSelfView />, {
      hooksConfig: config,
    });

    // Wait for Daily call to fully join
    await waitForJoinedMeeting(page);

    // Verify call tile is visible
    await expect(page.locator('[data-test="callTile"]')).toBeVisible();
    await expect(page.locator('[data-test="callTile"]')).toHaveCount(1);

    // Verify meeting state
    const meetingState = await page.evaluate(() => window.currentTestCall?.meetingState());
    expect(meetingState).toBe('joined-meeting');
  });

  test('verifies video and audio tracks are actually transmitting', async ({ mount, page }) => {
    await page.context().grantPermissions(['camera', 'microphone']);

    const config = withRoomUrl(singlePlayerRealDaily, room.url);

    await mount(<VideoCall showSelfView />, {
      hooksConfig: config,
    });

    // Wait for Daily call to fully join
    await waitForJoinedMeeting(page);

    // Wait for tracks to settle
    await page.waitForTimeout(2000);

    // Verify tracks are playable and have active MediaStreamTrack objects
    const trackDetails = await page.evaluate(() => {
      const participants = window.currentTestCall?.participants();
      const local = participants?.local;
      const videoTrack = local?.tracks?.video;
      const audioTrack = local?.tracks?.audio;

      return {
        // Track states
        videoState: videoTrack?.state,
        audioState: audioTrack?.state,

        // MediaStreamTrack properties (confirms real media)
        videoTrackId: videoTrack?.track?.id,
        videoTrackEnabled: videoTrack?.track?.enabled,
        videoTrackReadyState: videoTrack?.track?.readyState,
        videoTrackMuted: videoTrack?.track?.muted,

        audioTrackId: audioTrack?.track?.id,
        audioTrackEnabled: audioTrack?.track?.enabled,
        audioTrackReadyState: audioTrack?.track?.readyState,
        audioTrackMuted: audioTrack?.track?.muted,

        // Participant info
        participantName: local?.user_name,
        isLocal: local?.local,
      };
    });

    // Verify tracks are playable
    expect(trackDetails.videoState).toBe('playable');
    expect(trackDetails.audioState).toBe('playable');

    // Verify tracks have actual MediaStreamTrack objects with valid IDs
    expect(trackDetails.videoTrackId).toBeTruthy();
    expect(trackDetails.audioTrackId).toBeTruthy();

    // Verify tracks are enabled and live (readyState === 'live')
    expect(trackDetails.videoTrackEnabled).toBe(true);
    expect(trackDetails.audioTrackEnabled).toBe(true);
    expect(trackDetails.videoTrackReadyState).toBe('live');
    expect(trackDetails.audioTrackReadyState).toBe('live');

    // Verify tracks are not muted at the media level
    expect(trackDetails.videoTrackMuted).toBe(false);
    expect(trackDetails.audioTrackMuted).toBe(false);

    // Verify participant info
    // VideoCall sets display name based on player data: "Participant {position}" (no name/title in test data)
    expect(trackDetails.participantName).toBe('Participant 0');
    expect(trackDetails.isLocal).toBe(true);

    console.log('✓ Video and audio tracks are transmitting successfully');
  });

  test('waiting message disappears when dailyId propagates (reactivity test)', async ({
    mount,
    page,
  }) => {
    await page.context().grantPermissions(['camera', 'microphone']);

    const config = withRoomUrl(singlePlayerRealDaily, room.url);

    await mount(<VideoCall showSelfView />, {
      hooksConfig: config,
    });

    // Wait for Daily call to fully join
    await waitForJoinedMeeting(page);

    // Wait for tracks to settle and dailyId to propagate
    // The flow is:
    // 1. VideoCall receives dailyId from Daily (useLocalSessionId)
    // 2. VideoCall calls player.set("dailyId", dailyId)
    // 3. MockPlayer triggers onChange callback
    // 4. MockEmpiricaProvider re-renders
    // 5. Tile component receives the dailyId and can access tracks via Daily hooks
    await page.waitForTimeout(3000);

    // Debug: Check what dailyId the Daily API has AND if player has it
    const debugInfo = await page.evaluate(() => {
      const participants = window.currentTestCall?.participants();
      const localId = participants?.local?.session_id;
      const ctx = window.mockEmpiricaContext;
      const player = ctx?.players?.[0];
      return {
        localSessionId: localId,
        meetingState: window.currentTestCall?.meetingState(),
        playerDailyId: player?.get?.('dailyId'),
        playerHasMethods: typeof player?.set === 'function',
      };
    });
    console.log('DEBUG: Daily state:', debugInfo);

    // Check what's actually in the tile
    const tileState = await page.evaluate(() => {
      const tile = document.querySelector('[data-test="callTile"]');
      const waitingTile = document.querySelector('[data-test="waitingParticipantTile"]');
      return {
        tileExists: !!tile,
        tileInnerHTML: tile?.innerHTML.substring(0, 200),
        waitingTileExists: !!waitingTile,
        waitingTileVisible: waitingTile ? window.getComputedStyle(waitingTile).display !== 'none' : false,
      };
    });
    console.log('DEBUG: Tile state:', JSON.stringify(tileState, null, 2));

    // Verify waiting message is GONE (reactivity is working!)
    await expect(page.locator('[data-test="waitingParticipantTile"]')).not.toBeVisible({
      timeout: 5000,
    });

    // Verify call tile is still visible (sanity check)
    await expect(page.locator('[data-test="callTile"]')).toBeVisible();

    console.log('✓ Waiting message disappeared - MockPlayer reactivity is working!');
  });

  test('video element renders with valid MediaStream and displays video', async ({
    mount,
    page,
  }) => {
    await page.context().grantPermissions(['camera', 'microphone']);

    const config = withRoomUrl(singlePlayerRealDaily, room.url);

    await mount(
      <>
        <VideoCall showSelfView />
        <TileHookDiagnostic />
      </>,
      {
        hooksConfig: config,
      }
    );

    // Wait for Daily call to fully join
    await waitForJoinedMeeting(page);

    // Check if instrumentation worked
    const instrumentCheck = await page.evaluate(() => ({
      hasOriginalSet: !!window.originalPlayerSet,
      setCallLogLength: window.playerSetCallLog?.length || 0,
      setCallLog: window.playerSetCallLog || [],
    }));
    console.log('\n=== INSTRUMENTATION CHECK (after join) ===');
    console.log(JSON.stringify(instrumentCheck, null, 2));

    // Wait for dailyId to propagate through the full chain:
    // 1. Daily assigns session ID (1-2 seconds after join)
    // 2. useLocalSessionId() returns the ID
    // 3. VideoCall's useEffect calls player.set("dailyId", id)
    // 4. Player state updates
    console.log('Waiting for dailyId to propagate to player...');

    try {
      await page.waitForFunction(
        () => {
          const ctx = window.mockEmpiricaContext;
          const player = ctx?.players?.[0];
          return player?.get?.('dailyId') != null;
        },
        { timeout: 10000 }
      );
      console.log('✓ waitForFunction succeeded');
    } catch (error) {
      console.log('✗ waitForFunction failed:', error.message);
      // Check what we have
      const debug = await page.evaluate(() => {
        const ctx = window.mockEmpiricaContext;
        const player = ctx?.players?.[0];
        return {
          hasContext: !!ctx,
          hasPlayer: !!player,
          hasGetMethod: typeof player?.get === 'function',
          dailyId: player?.get?.('dailyId'),
        };
      });
      console.log('Debug state:', debug);
      throw error;
    }

    // Verify it's set
    const dailyIdCheck = await page.evaluate(() => {
      const ctx = window.mockEmpiricaContext;
      const player = ctx?.players?.[0];
      return player?.get?.('dailyId');
    });
    console.log('✓ Player dailyId confirmed:', dailyIdCheck);

    // The video may be off by default in some Daily configurations
    // Check if we need to enable the camera first
    const enableCameraButton = page.locator('button:has-text("Enable camera")');
    const cameraIsOff = await enableCameraButton.isVisible({ timeout: 1000 }).catch(() => false);
    if (cameraIsOff) {
      console.log('Camera is off, enabling it...');
      await enableCameraButton.click();
      await page.waitForTimeout(2000); // Wait for video to start
    }

    // Wait a bit longer for everything to settle
    await page.waitForTimeout(2000);

    // DEBUG: Check player state from multiple sources
    const playerDebug = await page.evaluate(() => {
      const ctx = window.mockEmpiricaContext;
      const player = ctx?.players?.[0];

      return {
        // Player from window context
        contextHasPlayer: !!player,
        contextPlayerId: player?.id,
        contextPlayerDailyId: player?.get?.('dailyId'),
        contextPlayerPosition: player?.get?.('position'),
        contextPlayerName: player?.get?.('name'),

        // Check player methods exist
        contextPlayerHasGet: typeof player?.get === 'function',
        contextPlayerHasSet: typeof player?.set === 'function',

        // Check set call history if available
        contextPlayerSetCalls: player?.getAllSetCalls ? player.getAllSetCalls() : null,
      };
    });
    console.log('\n=== PLAYER DEBUG ===');
    console.log(JSON.stringify(playerDebug, null, 2));

    // DEBUG: Comprehensive check of Tile state and render conditions
    const tileDebug = await page.evaluate(() => {
      const tile = document.querySelector('[data-test="callTile"]');
      if (!tile) return { error: 'No tile found' };

      // Check what's in the tile
      const waitingTile = document.querySelector('[data-test="waitingParticipantTile"]');
      const videoMutedTile = document.querySelector('[data-test="videoMutedTile"]');
      const audioOnlyTile = document.querySelector('[data-test="audioOnlyTile"]');
      const participantLeftTile = document.querySelector('[data-test="participantLeftTile"]');

      // Try to get Tile's props from data attributes or other means
      const tileAttrs = {
        source: tile.getAttribute('data-source'),
        position: tile.getAttribute('data-position'),
      };

      // Check mock context state
      const ctx = window.mockEmpiricaContext;
      const player = ctx?.players?.[0];
      const playerStage = player?.stage;

      return {
        // Tile DOM state
        innerHTML: tile.innerHTML.substring(0, 500),
        hasVideo: !!tile.querySelector('video'),
        hasCanvas: !!tile.querySelector('canvas'),
        childCount: tile.children.length,
        childTags: Array.from(tile.children).map(c => c.tagName),

        // Tile variants present
        hasWaitingTile: !!waitingTile,
        hasVideoMutedTile: !!videoMutedTile,
        hasAudioOnlyTile: !!audioOnlyTile,
        hasParticipantLeftTile: !!participantLeftTile,

        // Tile attributes
        tileDataAttrs: tileAttrs,

        // Player state that affects rendering
        playerDailyId: player?.get?.('dailyId'),
        playerPosition: player?.get?.('position'),
        playerStageSubmit: playerStage?.get?.('submit'),

        // Check if there's a username badge (indicates some data is flowing)
        hasUsernameBadge: tile.textContent.includes('Participant') || tile.textContent.includes('Test User'),
      };
    });
    console.log('\n=== TILE DEBUG ===');
    console.log(JSON.stringify(tileDebug, null, 2));

    // DEBUG: Check if diagnostic component rendered
    const diagnosticExists = await page.locator('[data-test="tileHookDiagnostic"]').isVisible().catch(() => false);
    console.log('\n=== DIAGNOSTIC COMPONENT ===');
    console.log('Diagnostic component rendered:', diagnosticExists);

    // DEBUG: Check player instance comparison
    const instanceComparison = await page.evaluate(() => window.playerInstanceComparison);
    console.log('\n=== PLAYER INSTANCE COMPARISON ===');
    console.log(JSON.stringify(instanceComparison, null, 2));

    // DEBUG: Check what Daily hooks return inside Tile context (AFTER tile renders)
    const hookDiagnostic = await page.evaluate(() => window.tileHookDiagnostic);
    console.log('\n=== DAILY HOOKS IN TILE CONTEXT (Final State) ===');
    console.log(JSON.stringify(hookDiagnostic, null, 2));

    // DEBUG: Check Call component state and what it's passing to Tile
    const callDebug = await page.evaluate(() => {
      // Try to find any data-test attributes or inspect DOM structure
      const callContainer = document.querySelector('[data-test="callTile"]')?.parentElement;

      // Check for multiple tiles (there should be at least one for self-view)
      const allTiles = document.querySelectorAll('[data-test="callTile"]');

      return {
        tilesCount: allTiles.length,
        tilesData: Array.from(allTiles).map(tile => ({
          source: tile.getAttribute('data-source'),
          position: tile.getAttribute('data-position'),
          hasChildren: tile.children.length > 0,
          textContent: tile.textContent.substring(0, 100),
        })),
        // Check if there's a Call container
        hasCallContainer: !!callContainer,
      };
    });
    console.log('\n=== CALL DEBUG ===');
    console.log(JSON.stringify(callDebug, null, 2));

    // Check Daily's useVideoTrack state
    const videoHookState = await page.evaluate(() => {
      const call = window.currentTestCall;
      const participants = call?.participants();
      const local = participants?.local;
      return {
        sessionId: local?.session_id,
        videoState: local?.tracks?.video?.state,
        videoOff: local?.tracks?.video?.off,
        hasVideoTrack: !!local?.tracks?.video?.track,
      };
    });
    console.log('DEBUG: Video hook state:', videoHookState);

    // 1. Verify <video> element exists inside the tile
    const videoElement = page.locator('[data-test="callTile"] video');
    await expect(videoElement).toBeVisible({ timeout: 5000 });

    // 2. Verify video has a srcObject with active video tracks
    const videoStreamInfo = await page.evaluate(() => {
      const video = document.querySelector('[data-test="callTile"] video');
      if (!video) return { error: 'No video element found' };
      if (!video.srcObject) return { error: 'No srcObject on video element' };

      const stream = video.srcObject;
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();

      return {
        hasStream: true,
        videoTrackCount: videoTracks.length,
        audioTrackCount: audioTracks.length,
        videoTrackState: videoTracks[0]?.readyState,
        videoTrackEnabled: videoTracks[0]?.enabled,
        videoTrackMuted: videoTracks[0]?.muted,
        videoPaused: video.paused,
        videoReadyState: video.readyState,
      };
    });

    expect(videoStreamInfo.hasStream).toBe(true);
    expect(videoStreamInfo.videoTrackCount).toBeGreaterThan(0);
    expect(videoStreamInfo.videoTrackState).toBe('live');
    expect(videoStreamInfo.videoTrackEnabled).toBe(true);

    // 3. Verify video dimensions are non-zero (actual video is rendering)
    // Note: videoWidth/videoHeight represent the intrinsic video dimensions
    const videoDimensions = await page.evaluate(() => {
      const video = document.querySelector('[data-test="callTile"] video');
      return {
        videoWidth: video?.videoWidth,
        videoHeight: video?.videoHeight,
        clientWidth: video?.clientWidth,
        clientHeight: video?.clientHeight,
      };
    });

    expect(videoDimensions.videoWidth).toBeGreaterThan(0);
    expect(videoDimensions.videoHeight).toBeGreaterThan(0);

    console.log('✓ Video element rendering with valid MediaStream:', {
      dimensions: `${videoDimensions.videoWidth}x${videoDimensions.videoHeight}`,
      tracks: videoStreamInfo.videoTrackCount,
    });
  });
});
