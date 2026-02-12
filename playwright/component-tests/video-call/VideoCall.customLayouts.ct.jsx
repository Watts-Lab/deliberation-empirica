import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../../client/src/call/VideoCall';
import {
  twoByTwoGrid,
  pictureInPicture,
  telephoneGame,
  breakoutRooms,
  hideSelfView,
} from '../shared/layout-fixtures';
import { assertZIndexOrder, assertNoTileOverlap } from '../shared/layout-helpers';

/**
 * Custom Layout Tests for VideoCall Component
 *
 * These tests verify that VideoCall correctly renders custom layouts,
 * breakout rooms, and layout configurations from treatment files.
 *
 * Migrated from Cypress test: cypress/fixtures/mockCDN/test/discussionLayout
 */
test.describe('VideoCall - Custom Layouts', () => {
  test('2x2 grid layout positions tiles correctly', async ({ mount }) => {
    const component = await mount(
      <VideoCall showSelfView layout={twoByTwoGrid.layout} />,
      {
        hooksConfig: twoByTwoGrid,
      }
    );

    // Should see 3 tiles (Player 1, self, Player 2)
    await expect(component.locator('[data-test="callTile"]')).toHaveCount(3, {
      timeout: 10000,
    });

    // All tiles should be visible
    const tiles = component.locator('[data-test="callTile"]');
    for (let i = 0; i < 3; i++) {
      await expect(tiles.nth(i)).toBeVisible();
    }

    // Self tile should be marked as such
    const selfTile = component.locator('[data-test="callTile"][data-source="self"]');
    await expect(selfTile).toBeVisible();

    // Tiles should not overlap (no z-index stacking in 2x2 grid)
    await assertNoTileOverlap(component, expect);
  });

  test('picture-in-picture layout with overlapping tiles', async ({ mount }) => {
    const component = await mount(
      <VideoCall showSelfView layout={pictureInPicture.layout} />,
      {
        hooksConfig: pictureInPicture,
      }
    );

    // Should see 3 tiles
    await expect(component.locator('[data-test="callTile"]')).toHaveCount(3, {
      timeout: 10000,
    });

    // Check that Player 2 shows audio-only tile (video: false in layout)
    const player2Tile = component.locator('[data-test="callTile"][data-position="2"]');
    await expect(player2Tile).toBeVisible();
    // When media.video is false, should show audioOnlyTile
    await expect(player2Tile.locator('[data-test="audioOnlyTile"]')).toBeVisible();

    // Self tile should be visible (small PiP in corner)
    const selfTile = component.locator('[data-test="callTile"][data-source="self"]');
    await expect(selfTile).toBeVisible();

    // IMPORTANT: PiP layout has overlapping tiles with z-index ordering
    // Looking at the 4x4 grid layout:
    // - Player 1: rows 0-1, cols 0-3 (top half, zOrder: 5)
    // - Player 2: rows 2-3, cols 0-3 (bottom half, no zOrder = 1)
    // - Self: row 3, col 3 (bottom-right corner, zOrder: 10)
    // Self tile overlaps with Player 2's region, not Player 1

    // Verify self tile has higher z-index than both other tiles
    const player1Tile = component.locator('[data-test="callTile"][data-position="1"]');
    await assertZIndexOrder(selfTile, player1Tile, expect);
    await assertZIndexOrder(selfTile, player2Tile, expect);

    // Check that self tile actually overlaps with Player 2
    const selfBox = await selfTile.boundingBox();
    const player2Box = await player2Tile.boundingBox();

    // Check if boxes overlap (in PiP they should)
    const overlaps = !(
      selfBox.x + selfBox.width <= player2Box.x ||
      player2Box.x + player2Box.width <= selfBox.x ||
      selfBox.y + selfBox.height <= player2Box.y ||
      player2Box.y + player2Box.height <= selfBox.y
    );

    expect(overlaps, 'PiP: self tile (bottom-right) should overlap with Player 2 (bottom half)').toBe(true);
  });

  test('telephone game layout shows asymmetric views', async ({ mount }) => {
    // Player 0 should only see Player 1
    const component = await mount(
      <VideoCall showSelfView={false} layout={telephoneGame.layout} />,
      {
        hooksConfig: {
          ...telephoneGame,
          empirica: {
            ...telephoneGame.empirica,
            currentPlayerId: 'p0',
          },
        },
      }
    );

    // Should see exactly 1 tile (Player 1 only)
    await expect(component.locator('[data-test="callTile"]')).toHaveCount(1, {
      timeout: 10000,
    });

    // Should be Player 1's tile
    await expect(component.locator('[data-test="callTile"][data-position="1"]')).toBeVisible();

    // Should NOT see Player 2's tile
    await expect(component.locator('[data-test="callTile"][data-position="2"]')).not.toBeVisible();
  });

  test('telephone game layout - Player 1 sees only Player 2', async ({ mount }) => {
    // Switch to Player 1's perspective
    const component = await mount(
      <VideoCall showSelfView={false} layout={telephoneGame.layout} />,
      {
        hooksConfig: {
          ...telephoneGame,
          empirica: {
            ...telephoneGame.empirica,
            currentPlayerId: 'p1',
          },
          daily: {
            ...telephoneGame.daily,
            localSessionId: 'daily-p1',
          },
        },
      }
    );

    // Should see exactly 1 tile (Player 2 only)
    await expect(component.locator('[data-test="callTile"]')).toHaveCount(1, {
      timeout: 10000,
    });

    // Should be Player 2's tile
    await expect(component.locator('[data-test="callTile"][data-position="2"]')).toBeVisible();
  });

  test('breakout rooms - Player 0 sees only roommates', async ({ mount }) => {
    const component = await mount(
      <VideoCall showSelfView rooms={breakoutRooms.rooms} />,
      {
        hooksConfig: {
          ...breakoutRooms,
          empirica: {
            ...breakoutRooms.empirica,
            currentPlayerId: 'p0',
          },
        },
      }
    );

    // Player 0 is in room with Player 1, so should see 2 tiles (self + Player 1)
    await expect(component.locator('[data-test="callTile"]')).toHaveCount(2, {
      timeout: 10000,
    });

    // Should see self and Player 1
    await expect(component.locator('[data-test="callTile"][data-position="0"]')).toBeVisible();
    await expect(component.locator('[data-test="callTile"][data-position="1"]')).toBeVisible();

    // Should NOT see Player 2 (different room)
    await expect(component.locator('[data-test="callTile"][data-position="2"]')).not.toBeVisible();

    // Tiles should not overlap
    await assertNoTileOverlap(component, expect);
  });

  test('breakout rooms - Player 2 is alone', async ({ mount }) => {
    const component = await mount(
      <VideoCall showSelfView rooms={breakoutRooms.rooms} />,
      {
        hooksConfig: {
          ...breakoutRooms,
          empirica: {
            ...breakoutRooms.empirica,
            currentPlayerId: 'p2',
          },
          daily: {
            ...breakoutRooms.daily,
            localSessionId: 'daily-p2',
          },
        },
      }
    );

    // Player 2 is alone in their room, should only see self
    await expect(component.locator('[data-test="callTile"]')).toHaveCount(1, {
      timeout: 10000,
    });

    // Should be self tile
    const selfTile = component.locator('[data-test="callTile"][data-source="self"]');
    await expect(selfTile).toBeVisible();
  });

  test('hide self view removes player\'s own tile', async ({ mount }) => {
    const component = await mount(
      <VideoCall showSelfView={false} />, // showSelfView=false hides own tile
      {
        hooksConfig: hideSelfView,
      }
    );

    // Should see 2 tiles (Player 1 and Player 2, not self)
    await expect(component.locator('[data-test="callTile"]')).toHaveCount(2, {
      timeout: 10000,
    });

    // Should see other players
    await expect(component.locator('[data-test="callTile"][data-position="1"]')).toBeVisible();
    await expect(component.locator('[data-test="callTile"][data-position="2"]')).toBeVisible();

    // Should NOT see self tile
    const selfTile = component.locator('[data-test="callTile"][data-source="self"]');
    await expect(selfTile).not.toBeVisible();

    // Tiles should not overlap
    await assertNoTileOverlap(component, expect);
  });
});
