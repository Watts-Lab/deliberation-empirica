import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../../client/src/call/VideoCall';
import {
  singlePlayerConnected,
  twoPlayersOneWaiting,
  threePlayersConnected,
} from '../shared/fixtures';
import {
  assertNoTileOverlap,
  assertSpaceFilling,
  detectLayoutOrientation,
} from '../shared/layout-helpers';

/**
 * Responsive Layout Tests for VideoCall Component
 *
 * These tests verify that the VideoCall component's automatic layout
 * adapts correctly to:
 * - Different numbers of participants (1, 2, 3, 4, 5+ players)
 * - Different screen widths (narrow mobile, tablet, desktop)
 * - Dynamic window resizing
 *
 * Tests the DEFAULT responsive layout (not custom layouts from treatment files).
 */

/**
 * Create a player fixture with N players, all connected
 */
function createNPlayerFixture(playerCount) {
  const players = [];
  const participantIds = [];
  const videoTracks = {};
  const audioTracks = {};

  for (let i = 0; i < playerCount; i++) {
    const playerId = `p${i}`;
    const dailyId = `daily-p${i}`;

    players.push({
      id: playerId,
      attrs: { name: `Player ${i}`, position: String(i), dailyId },
    });
    participantIds.push(dailyId);
    videoTracks[dailyId] = { isOff: false, subscribed: true };
    audioTracks[dailyId] = { isOff: false, subscribed: true };
  }

  return {
    empirica: {
      currentPlayerId: 'p0',
      players,
      game: { attrs: { dailyUrl: 'https://test.daily.co/room' } },
      stage: { attrs: {} },
      stageTimer: { elapsed: 0 },
    },
    daily: {
      localSessionId: 'daily-p0',
      participantIds,
      videoTracks,
      audioTracks,
    },
  };
}

test.describe('VideoCall - Responsive Layout', () => {
  test.describe('Different Player Counts', () => {
    test('1 player - shows only self', async ({ mount }) => {
      const component = await mount(<VideoCall showSelfView />, {
        hooksConfig: singlePlayerConnected,
      });

      await expect(component.locator('[data-test="callTile"]')).toHaveCount(1, {
        timeout: 10000,
      });

      const selfTile = component.locator('[data-test="callTile"][data-source="self"]');
      await expect(selfTile).toBeVisible();
    });

    test('2 players - both visible', async ({ mount }) => {
      const component = await mount(<VideoCall showSelfView />, {
        hooksConfig: twoPlayersOneWaiting,
      });

      // Should see 2 tiles (self + 1 other, even though other is waiting)
      await expect(component.locator('[data-test="callTile"]')).toHaveCount(2, {
        timeout: 10000,
      });
    });

    test('3 players - all visible', async ({ mount }) => {
      const component = await mount(<VideoCall showSelfView />, {
        hooksConfig: threePlayersConnected,
      });

      await expect(component.locator('[data-test="callTile"]')).toHaveCount(3, {
        timeout: 10000,
      });

      // Verify each player's tile is visible
      await expect(component.locator('[data-test="callTile"][data-position="0"]')).toBeVisible();
      await expect(component.locator('[data-test="callTile"][data-position="1"]')).toBeVisible();
      await expect(component.locator('[data-test="callTile"][data-position="2"]')).toBeVisible();
    });

    test('4 players - all visible', async ({ mount }) => {
      const fixture = createNPlayerFixture(4);
      const component = await mount(<VideoCall showSelfView />, {
        hooksConfig: fixture,
      });

      await expect(component.locator('[data-test="callTile"]')).toHaveCount(4, {
        timeout: 10000,
      });

      // Should arrange in 2x2 grid
      for (let i = 0; i < 4; i++) {
        await expect(
          component.locator(`[data-test="callTile"][data-position="${i}"]`)
        ).toBeVisible();
      }
    });

    test('6 players - all visible', async ({ mount }) => {
      const fixture = createNPlayerFixture(6);
      const component = await mount(<VideoCall showSelfView />, {
        hooksConfig: fixture,
      });

      await expect(component.locator('[data-test="callTile"]')).toHaveCount(6, {
        timeout: 10000,
      });

      // All tiles should be visible
      for (let i = 0; i < 6; i++) {
        await expect(
          component.locator(`[data-test="callTile"][data-position="${i}"]`)
        ).toBeVisible();
      }
    });
  });

  test.describe('Different Screen Widths', () => {
    test('narrow screen (mobile) - 3 players stack appropriately', async ({ mount, page }) => {
      // Set viewport to mobile width
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size

      const component = await mount(<VideoCall showSelfView />, {
        hooksConfig: threePlayersConnected,
      });

      // All tiles should still render
      await expect(component.locator('[data-test="callTile"]')).toHaveCount(3, {
        timeout: 10000,
      });

      // All tiles should be visible (layout may be vertical/stacked)
      const tiles = component.locator('[data-test="callTile"]');
      for (let i = 0; i < 3; i++) {
        await expect(tiles.nth(i)).toBeVisible();
      }
    });

    test('medium screen (tablet) - 3 players arranged efficiently', async ({ mount, page }) => {
      // Set viewport to tablet width
      await page.setViewportSize({ width: 768, height: 1024 }); // iPad size

      const component = await mount(<VideoCall showSelfView />, {
        hooksConfig: threePlayersConnected,
      });

      await expect(component.locator('[data-test="callTile"]')).toHaveCount(3, {
        timeout: 10000,
      });

      const tiles = component.locator('[data-test="callTile"]');
      for (let i = 0; i < 3; i++) {
        await expect(tiles.nth(i)).toBeVisible();
      }
    });

    test('wide screen (desktop) - 3 players arranged efficiently', async ({ mount, page }) => {
      // Set viewport to desktop width
      await page.setViewportSize({ width: 1920, height: 1080 }); // Full HD

      const component = await mount(<VideoCall showSelfView />, {
        hooksConfig: threePlayersConnected,
      });

      await expect(component.locator('[data-test="callTile"]')).toHaveCount(3, {
        timeout: 10000,
      });

      const tiles = component.locator('[data-test="callTile"]');
      for (let i = 0; i < 3; i++) {
        await expect(tiles.nth(i)).toBeVisible();
      }
    });
  });

  test.describe('Dynamic Resizing', () => {
    test('tiles remain visible when window resizes', async ({ mount, page }) => {
      // Start at desktop size
      await page.setViewportSize({ width: 1920, height: 1080 });

      const component = await mount(<VideoCall showSelfView />, {
        hooksConfig: threePlayersConnected,
      });

      // Verify initial render
      await expect(component.locator('[data-test="callTile"]')).toHaveCount(3, {
        timeout: 10000,
      });

      // Resize to tablet
      await page.setViewportSize({ width: 768, height: 1024 });

      // Wait a bit for ResizeObserver to trigger
      await page.waitForTimeout(500);

      // Tiles should still be visible after resize
      await expect(component.locator('[data-test="callTile"]')).toHaveCount(3);
      const tiles = component.locator('[data-test="callTile"]');
      for (let i = 0; i < 3; i++) {
        await expect(tiles.nth(i)).toBeVisible();
      }

      // Resize to mobile
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);

      // Tiles should STILL be visible
      await expect(component.locator('[data-test="callTile"]')).toHaveCount(3);
      for (let i = 0; i < 3; i++) {
        await expect(tiles.nth(i)).toBeVisible();
      }
    });

    test('layout adjusts for many players on narrow screen', async ({ mount, page }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // Mobile

      const fixture = createNPlayerFixture(6);
      const component = await mount(<VideoCall showSelfView />, {
        hooksConfig: fixture,
      });

      // All 6 tiles should render even on narrow screen
      await expect(component.locator('[data-test="callTile"]')).toHaveCount(6, {
        timeout: 10000,
      });

      // All should be visible (may require scrolling or stacking)
      const tiles = component.locator('[data-test="callTile"]');
      for (let i = 0; i < 6; i++) {
        await expect(tiles.nth(i)).toBeVisible();
      }
    });
  });

  test.describe('Layout Quality Checks', () => {
    test('tiles do not overlap (3 players)', async ({ mount }) => {
      const component = await mount(<VideoCall showSelfView />, {
        hooksConfig: threePlayersConnected,
      });

      await expect(component.locator('[data-test="callTile"]')).toHaveCount(3, {
        timeout: 10000,
      });

      // Verify no tiles overlap each other
      await assertNoTileOverlap(component, expect);
    });

    test('tiles efficiently fill container space (3 players)', async ({ mount }) => {
      const component = await mount(<VideoCall showSelfView />, {
        hooksConfig: threePlayersConnected,
      });

      await expect(component.locator('[data-test="callTile"]')).toHaveCount(3, {
        timeout: 10000,
      });

      // Verify tiles fill either width or height of container
      await assertSpaceFilling(component, expect);
    });

    test('tiles do not overlap (6 players)', async ({ mount }) => {
      const fixture = createNPlayerFixture(6);
      const component = await mount(<VideoCall showSelfView />, {
        hooksConfig: fixture,
      });

      await expect(component.locator('[data-test="callTile"]')).toHaveCount(6, {
        timeout: 10000,
      });

      // With more tiles, ensure they still don't overlap
      await assertNoTileOverlap(component, expect);
    });
  });

  test.describe('Layout Adapts to Container Size', () => {
    test('wide container (landscape) arranges tiles efficiently', async ({ mount, page }) => {
      // Very wide, short container
      await page.setViewportSize({ width: 1600, height: 400 });

      const component = await mount(<VideoCall showSelfView />, {
        hooksConfig: threePlayersConnected,
      });

      await expect(component.locator('[data-test="callTile"]')).toHaveCount(3, {
        timeout: 10000,
      });

      // Tiles should not overlap
      await assertNoTileOverlap(component, expect);

      // All tiles should be visible
      const tiles = component.locator('[data-test="callTile"]');
      for (let i = 0; i < 3; i++) {
        await expect(tiles.nth(i)).toBeVisible();
      }
    });

    test('narrow container (portrait) arranges tiles efficiently', async ({ mount, page }) => {
      // Tall, narrow container
      await page.setViewportSize({ width: 400, height: 1200 });

      const component = await mount(<VideoCall showSelfView />, {
        hooksConfig: threePlayersConnected,
      });

      await expect(component.locator('[data-test="callTile"]')).toHaveCount(3, {
        timeout: 10000,
      });

      // Tiles should not overlap
      await assertNoTileOverlap(component, expect);

      // All tiles should be visible
      const tiles = component.locator('[data-test="callTile"]');
      for (let i = 0; i < 3; i++) {
        await expect(tiles.nth(i)).toBeVisible();
      }
    });

    test('layout recalculates on window resize', async ({ mount, page }) => {
      // Start with landscape orientation
      await page.setViewportSize({ width: 1200, height: 400 });

      const component = await mount(<VideoCall showSelfView />, {
        hooksConfig: threePlayersConnected,
      });

      await expect(component.locator('[data-test="callTile"]')).toHaveCount(3, {
        timeout: 10000,
      });

      // Verify initial state
      await assertNoTileOverlap(component, expect);

      // Rotate to portrait
      await page.setViewportSize({ width: 400, height: 1200 });
      await page.waitForTimeout(500); // Wait for ResizeObserver

      // Tiles should still not overlap after resize
      await assertNoTileOverlap(component, expect);

      // All tiles should still be visible
      const tiles = component.locator('[data-test="callTile"]');
      for (let i = 0; i < 3; i++) {
        await expect(tiles.nth(i)).toBeVisible();
      }
    });
  });
});
