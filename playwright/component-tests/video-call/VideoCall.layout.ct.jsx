import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../../client/src/call/VideoCall';
import { threePlayersConnected } from '../shared/fixtures';

/**
 * Layout Tests for VideoCall Component
 *
 * These tests verify that the VideoCall component correctly displays
 * tiles for different numbers of participants and that the layout
 * adapts appropriately:
 * - Multiple tiles rendered for all connected players
 * - Tiles arranged in grid or responsive layout
 * - All participants visible simultaneously
 */
test.describe('VideoCall - Layout & Multi-player', () => {
  test('multi-player scenario with three connected players', async ({ mount }) => {
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: threePlayersConnected,
    });

    // Should see tiles for all 3 players
    await expect(component.locator('[data-test="callTile"]')).toHaveCount(3, {
      timeout: 10000,
    });

    // Verify each player's tile is visible
    await expect(component.locator('[data-test="callTile"][data-position="0"]')).toBeVisible();
    await expect(component.locator('[data-test="callTile"][data-position="1"]')).toBeVisible();
    await expect(component.locator('[data-test="callTile"][data-position="2"]')).toBeVisible();
  });
});
