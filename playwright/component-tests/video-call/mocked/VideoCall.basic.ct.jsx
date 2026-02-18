import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../../../client/src/call/VideoCall';
import { singlePlayerConnected } from '../../shared/fixtures';

/**
 * Basic Smoke Tests for VideoCall Component
 *
 * These tests verify that the VideoCall component mounts and renders
 * without errors in standard configurations.
 */
test.describe('VideoCall - Basic Rendering', () => {
  test('renders without errors when properly configured', async ({ mount }) => {
    // Basic smoke test - component mounts with mock providers
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: singlePlayerConnected,
    });

    // Component should mount and be visible
    await expect(component).toBeVisible();
  });

  test('single player sees self-view tile', async ({ mount }) => {
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: singlePlayerConnected,
    });

    // Wait for the call tile to be visible
    await expect(component.locator('[data-test="callTile"]')).toBeVisible({
      timeout: 10000,
    });

    // Verify self tile is rendered
    const selfTile = component.locator('[data-test="callTile"][data-source="self"]');
    await expect(selfTile).toBeVisible();
  });
});
