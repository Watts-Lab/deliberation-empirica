import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../../client/src/call/VideoCall';
import {
  singlePlayerVideoMuted,
  singlePlayerNotConnected,
  twoPlayersOneWaiting,
} from '../shared/fixtures';

/**
 * Tile State Tests for VideoCall Component
 *
 * These tests verify that tiles display the correct states based on
 * connection status, media settings, and participant availability:
 * - Video muted indicator when camera is off
 * - Waiting state when participant hasn't connected to Daily
 * - Different waiting states for self vs others
 */
test.describe('VideoCall - Tile States', () => {
  test('video muted state shows muted indicator', async ({ mount }) => {
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: singlePlayerVideoMuted,
    });

    // Video muted tile should show when video is off
    await expect(component.locator('[data-test="videoMutedTile"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test('waiting state when I am not connected', async ({ mount }) => {
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: singlePlayerNotConnected,
    });

    // Should show waiting state when I haven't connected yet
    await expect(component.locator('[data-test="waitingParticipantTile"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test('waiting state when other player not connected', async ({ mount }) => {
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: twoPlayersOneWaiting,
    });

    // Should see 2 tiles - my connected tile and their waiting tile
    await expect(component.locator('[data-test="callTile"]')).toHaveCount(2, {
      timeout: 10000,
    });

    // My tile should show video (not waiting)
    const myTile = component.locator('[data-test="callTile"][data-position="0"]');
    await expect(myTile).toBeVisible();
    await expect(myTile.locator('[data-test="waitingParticipantTile"]')).not.toBeVisible();

    // Other player's tile should show waiting state
    const otherTile = component.locator('[data-test="callTile"][data-position="1"]');
    await expect(otherTile).toBeVisible();
    await expect(otherTile.locator('[data-test="waitingParticipantTile"]')).toBeVisible();
  });
});
