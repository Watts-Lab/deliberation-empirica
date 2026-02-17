import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../../../client/src/call/VideoCall';
import { createTestRoom, cleanupTestRoom } from '../../../helpers/daily.js';
import {
  singlePlayerRealDaily,
  singlePlayerWithCustomSpeaker,
  singlePlayerWithCustomDevices,
  withRoomUrl,
} from '../../shared/integration-fixtures';

/**
 * Edge Case Tests for Single-Participant VideoCall with Real Daily.co
 *
 * These tests verify browser-specific behaviors, device handling, and edge cases
 * that require real WebRTC connections but only single participants.
 *
 * Test Categories:
 * - Audio context management (Safari suspension, autoplay blocking)
 * - Device switching (camera, microphone, speaker mid-call)
 * - Permission handling (revocation, denial, recovery)
 * - Network interruptions (reconnection, state recovery)
 * - Browser-specific quirks (autoplay policies, audio constraints)
 *
 * Why Single-Participant?
 * - Playwright Component Testing can't sync state across multiple contexts
 * - Multi-participant coordination requires real Empirica backend (use Cypress E2E)
 * - These edge cases are testable with just one participant + real Daily
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

test.describe('VideoCall - Edge Cases (Single Participant)', () => {
  let room;

  test.beforeEach(async () => {
    room = await createTestRoom();
  });

  test.afterEach(async ({ page }) => {
    // Cleanup call objects in browser context
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

  test.describe('Audio Context Management', () => {
    test.skip('audio context resumes after user gesture', async ({ mount, page }) => {
      // TODO: Simulate Safari-like audio context suspension
      await page.context().grantPermissions(['camera', 'microphone']);

      const config = withRoomUrl(singlePlayerRealDaily, room.url);
      await mount(<VideoCall showSelfView />, { hooksConfig: config });

      // Wait for join
      await expect(page.locator('[data-test="loading"]')).toBeHidden({ timeout: 5000 });
      await page.waitForTimeout(2000);

      // Simulate audio context suspension (Safari-like behavior)
      await page.evaluate(() => {
        const audioContext = new AudioContext();
        return audioContext.suspend();
      });

      // TODO: Check if UI shows "Enable audio" prompt
      // TODO: Click prompt and verify audio context resumes
      // TODO: Verify speaker device is still selected
    });
  });

  test.describe('Device Switching', () => {
    test.skip('switching camera mid-call maintains connection', async ({ mount, page }) => {
      await page.context().grantPermissions(['camera', 'microphone']);

      const config = withRoomUrl(singlePlayerRealDaily, room.url);
      await mount(<VideoCall showSelfView />, { hooksConfig: config });

      // Wait for join
      await expect(page.locator('[data-test="loading"]')).toBeHidden({ timeout: 5000 });
      await page.waitForTimeout(2000);

      // Get initial camera device
      const initialCamera = await page.evaluate(() => {
        const call = window.currentTestCall;
        return call?.getInputDevices()?.camera;
      });

      // TODO: Trigger camera switch via UI
      // TODO: Verify new camera is active
      // TODO: Verify connection maintained (meetingState still 'joined-meeting')
      // TODO: Verify video track is still playable
    });

    test.skip('switching speaker preserves selection after reconnect', async ({
      mount,
      page,
    }) => {
      await page.context().grantPermissions(['camera', 'microphone']);

      const config = withRoomUrl(singlePlayerWithCustomSpeaker, room.url);
      await mount(<VideoCall showSelfView />, { hooksConfig: config });

      // Wait for join
      await expect(page.locator('[data-test="loading"]')).toBeHidden({ timeout: 5000 });
      await page.waitForTimeout(2000);

      // TODO: Set custom speaker via UI
      // TODO: Simulate network interruption (call.setNetworkTopology)
      // TODO: Wait for reconnect
      // TODO: Verify speaker is still the custom one (not default)
    });
  });

  test.describe('Permission Handling', () => {
    test.skip('camera permission denied shows helpful error', async ({ mount, page }) => {
      // Don't grant permissions - let it fail naturally
      const config = withRoomUrl(singlePlayerRealDaily, room.url);
      await mount(<VideoCall showSelfView />, { hooksConfig: config });

      // TODO: Wait for permission error
      // TODO: Verify error UI is shown
      // TODO: Verify error message mentions camera permission
      // TODO: Verify "Grant permission" button exists
    });

    test.skip('camera permission revoked mid-call shows error UI', async ({ mount, page }) => {
      await page.context().grantPermissions(['camera', 'microphone']);

      const config = withRoomUrl(singlePlayerRealDaily, room.url);
      await mount(<VideoCall showSelfView />, { hooksConfig: config });

      // Wait for join
      await expect(page.locator('[data-test="loading"]')).toBeHidden({ timeout: 5000 });
      await page.waitForTimeout(2000);

      // Revoke camera permission mid-call
      await page.context().clearPermissions();

      // TODO: Verify error UI appears
      // TODO: Verify tile shows error state
      // TODO: Verify user can re-request permission
    });
  });

  test.describe('Network Recovery', () => {
    test.skip('network interruption shows reconnecting state', async ({ mount, page }) => {
      await page.context().grantPermissions(['camera', 'microphone']);

      const config = withRoomUrl(singlePlayerRealDaily, room.url);
      await mount(<VideoCall showSelfView />, { hooksConfig: config });

      // Wait for join
      await expect(page.locator('[data-test="loading"]')).toBeHidden({ timeout: 5000 });
      await page.waitForTimeout(2000);

      // Simulate network interruption via Daily API
      await page.evaluate(() => {
        const call = window.currentTestCall;
        // Daily provides network simulation APIs
        // call.setNetworkTopology(...);
      });

      // TODO: Verify UI shows "Reconnecting..." state
      // TODO: Wait for reconnect
      // TODO: Verify UI returns to normal
      // TODO: Verify video track is still playable
    });
  });

  test.describe('Media Constraints', () => {
    test('tracks are in playable state', async ({ mount, page }) => {
      await page.context().grantPermissions(['camera', 'microphone']);

      const config = withRoomUrl(singlePlayerRealDaily, room.url);
      await mount(<VideoCall showSelfView />, { hooksConfig: config });

      // Wait for Daily call to fully join
      await waitForJoinedMeeting(page);
      await page.waitForTimeout(1000);

      // Verify video and audio tracks via Daily API
      const trackInfo = await page.evaluate(() => {
        const participants = window.currentTestCall?.participants();
        const local = participants?.local;
        const videoTrack = local?.tracks?.video;
        const audioTrack = local?.tracks?.audio;

        return {
          hasLocalParticipant: !!local,
          videoState: videoTrack?.state,
          audioState: audioTrack?.state,
          videoTrackId: videoTrack?.track?.id,
          audioTrackId: audioTrack?.track?.id,
        };
      });

      expect(trackInfo.hasLocalParticipant).toBe(true);
      expect(trackInfo.videoState).toBe('playable');
      expect(trackInfo.audioState).toBe('playable');
      expect(trackInfo.videoTrackId).toBeTruthy();
      expect(trackInfo.audioTrackId).toBeTruthy();
    });

    test('local participant has expected properties', async ({ mount, page }) => {
      await page.context().grantPermissions(['camera', 'microphone']);

      const config = withRoomUrl(singlePlayerRealDaily, room.url);
      await mount(<VideoCall showSelfView />, { hooksConfig: config });

      // Wait for Daily call to fully join
      await waitForJoinedMeeting(page);

      // Check Daily participant properties
      const participantInfo = await page.evaluate(() => {
        const participants = window.currentTestCall?.participants();
        const local = participants?.local;

        return {
          hasLocalParticipant: !!local,
          sessionId: local?.session_id,
          userName: local?.user_name,
          isLocal: local?.local,
          isOwner: local?.owner,
        };
      });

      expect(participantInfo.hasLocalParticipant).toBe(true);
      expect(participantInfo.sessionId).toBeTruthy();
      expect(participantInfo.userName).toBe('Test User');
      expect(participantInfo.isLocal).toBe(true);
    });
  });

  test.describe('Connection Lifecycle', () => {
    test('component connects and shows call tile', async ({ mount, page }) => {
      await page.context().grantPermissions(['camera', 'microphone']);

      const config = withRoomUrl(singlePlayerRealDaily, room.url);
      await mount(<VideoCall showSelfView />, { hooksConfig: config });

      // Wait for Daily call to fully join
      await waitForJoinedMeeting(page);

      // Verify call tile is visible
      await expect(page.locator('[data-test="callTile"]')).toBeVisible();

      // Verify meeting state
      const meetingState = await page.evaluate(() => window.currentTestCall?.meetingState());
      expect(meetingState).toBe('joined-meeting');
    });

    test('leaving call cleans up resources', async ({ mount, page }) => {
      await page.context().grantPermissions(['camera', 'microphone']);

      const config = withRoomUrl(singlePlayerRealDaily, room.url);
      await mount(<VideoCall showSelfView />, { hooksConfig: config });

      // Wait for Daily call to fully join
      await waitForJoinedMeeting(page);

      // Leave call
      await page.evaluate(() => {
        const call = window.currentTestCall;
        return call?.leave();
      });

      // Wait a moment for leave to process
      await page.waitForTimeout(500);

      // Verify meeting state
      const meetingState = await page.evaluate(() => window.currentTestCall?.meetingState());
      expect(meetingState).toBe('left-meeting');

      // TODO: Verify video tracks are stopped
      // TODO: Verify UI reflects left state
    });
  });
});
