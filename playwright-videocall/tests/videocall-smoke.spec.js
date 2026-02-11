/**
 * Smoke tests for video call functionality using LIVE Daily.co rooms
 *
 * These tests use real Daily.co endpoints to verify browser integration.
 * Run selectively to avoid excessive API usage.
 *
 * Usage:
 *   npx playwright test --grep "@smoke"
 */

import { test, expect } from '@playwright/test';
import { createTestRoom, deleteTestRoom } from '../fixtures/dailyHelpers';

test.describe('Video Call Smoke Tests @smoke', () => {
  let roomUrl;
  let roomName;

  test.beforeAll(async () => {
    if (!process.env.DAILY_APIKEY) {
      throw new Error('DAILY_APIKEY environment variable is required for smoke tests');
    }

    const room = await createTestRoom();
    roomUrl = room.url;
    roomName = room.name;
    console.log(`Created test room: ${roomName}`);
  });

  test.afterAll(async () => {
    if (roomName) {
      await deleteTestRoom(roomName);
      console.log(`Deleted test room: ${roomName}`);
    }
  });

  test('two participants can join and see each other @critical', async ({ browser }) => {
    // Create two browser contexts with camera/mic permissions
    const context1 = await browser.newContext({
      permissions: ['camera', 'microphone'],
    });
    const context2 = await browser.newContext({
      permissions: ['camera', 'microphone'],
    });

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Navigate both participants to the test room
      // Adjust this URL based on your app's routing
      await page1.goto(`/?playerKey=participant1&testRoomUrl=${encodeURIComponent(roomUrl)}`);
      await page2.goto(`/?playerKey=participant2&testRoomUrl=${encodeURIComponent(roomUrl)}`);

      // Skip intro/consent if needed (adjust selectors based on your app)
      await page1.click('button[data-test="joinButton"]', { timeout: 5000 }).catch(() => {});
      await page2.click('button[data-test="joinButton"]', { timeout: 5000 }).catch(() => {});

      // Wait for video call UI to load
      await page1.waitForSelector('[data-test="callTile"]', { timeout: 15000 });
      await page2.waitForSelector('[data-test="callTile"]', { timeout: 15000 });

      // Assert both participants see 2 tiles (self + remote)
      const tiles1 = await page1.locator('[data-test="callTile"]').count();
      const tiles2 = await page2.locator('[data-test="callTile"]').count();

      expect(tiles1).toBe(2);
      expect(tiles2).toBe(2);

      // Verify tracks are subscribed using Daily.co API
      const participant1Tracks = await page1.evaluate(() => {
        // Access Daily.co callObject from window (you'll need to expose this)
        const daily = window.dailyCallObject;
        if (!daily) return null;

        const participants = daily.participants();
        return Object.values(participants).map(p => ({
          sessionId: p.session_id,
          audio: p.tracks?.audio?.subscribed,
          video: p.tracks?.video?.subscribed,
        }));
      });

      console.log('Participant 1 sees tracks:', participant1Tracks);

      // At least one remote participant should have subscribed audio/video
      const hasSubscribedTracks = participant1Tracks?.some(
        p => p.audio === true && p.video === true
      );
      expect(hasSubscribedTracks).toBeTruthy();

    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('participant can toggle microphone @critical', async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ['camera', 'microphone'],
    });
    const page = await context.newPage();

    try {
      await page.goto(`/?playerKey=participant1&testRoomUrl=${encodeURIComponent(roomUrl)}`);
      await page.click('button[data-test="joinButton"]', { timeout: 5000 }).catch(() => {});
      await page.waitForSelector('[data-test="callTile"]', { timeout: 15000 });

      // Find and click the microphone toggle button
      const micButton = page.locator('button[data-test="toggleMic"]');
      await expect(micButton).toBeVisible({ timeout: 5000 });

      // Initial state: mic should be on
      const initialState = await page.evaluate(() => {
        const daily = window.dailyCallObject;
        return daily?.localAudio();
      });
      expect(initialState).toBe(true);

      // Toggle mic off
      await micButton.click();
      await page.waitForTimeout(500); // Wait for state update

      const mutedState = await page.evaluate(() => {
        const daily = window.dailyCallObject;
        return daily?.localAudio();
      });
      expect(mutedState).toBe(false);

      // Toggle mic back on
      await micButton.click();
      await page.waitForTimeout(500);

      const unmutedState = await page.evaluate(() => {
        const daily = window.dailyCallObject;
        return daily?.localAudio();
      });
      expect(unmutedState).toBe(true);

    } finally {
      await context.close();
    }
  });

  test('handles device errors gracefully', async ({ browser }) => {
    const context = await browser.newContext({
      // Deny camera/mic permissions to trigger error
      permissions: [],
    });
    const page = await context.newPage();

    try {
      await page.goto(`/?playerKey=participant1&testRoomUrl=${encodeURIComponent(roomUrl)}`);
      await page.click('button[data-test="joinButton"]', { timeout: 5000 }).catch(() => {});

      // Should show device error UI
      const errorMessage = page.locator('[data-test="deviceError"]');
      await expect(errorMessage).toBeVisible({ timeout: 10000 });

      // Error should mention permissions
      const errorText = await errorMessage.textContent();
      expect(errorText.toLowerCase()).toContain('permission');

    } finally {
      await context.close();
    }
  });
});

test.describe('Cross-Browser Device Tests @cross-browser', () => {
  test('device enumeration works in all browsers', async ({ browser, browserName }) => {
    const context = await browser.newContext({
      permissions: ['camera', 'microphone'],
    });
    const page = await context.newPage();

    try {
      await page.goto('/');

      // Wait for device enumeration to complete
      const devices = await page.evaluate(async () => {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return {
          cameras: devices.filter(d => d.kind === 'videoinput').length,
          mics: devices.filter(d => d.kind === 'audioinput').length,
          speakers: devices.filter(d => d.kind === 'audiooutput').length,
        };
      });

      console.log(`${browserName} detected devices:`, devices);

      // Should find at least one camera and mic (may be virtual in CI)
      expect(devices.cameras).toBeGreaterThan(0);
      expect(devices.mics).toBeGreaterThan(0);

      // Speakers may not be available in all browsers/environments
      if (browserName === 'chromium') {
        expect(devices.speakers).toBeGreaterThan(0);
      }

    } finally {
      await context.close();
    }
  });
});
