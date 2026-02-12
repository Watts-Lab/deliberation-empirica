import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../../client/src/call/VideoCall';

/**
 * Debug test for component testing infrastructure.
 * Useful for verifying the mock setup is working correctly.
 */
test('debug - verify mock providers working', async ({ mount, page }) => {
  // Capture console messages for debugging
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`Browser [${msg.type()}]:`, msg.text());
    }
  });

  page.on('pageerror', (error) => {
    console.log('Page error:', error.message);
  });

  const component = await mount(<VideoCall showSelfView />, {
    hooksConfig: {
      empirica: {
        currentPlayerId: 'p0',
        players: [{ id: 'p0', attrs: { name: 'Test User', position: '0' } }],
        game: { attrs: { dailyUrl: 'https://test.daily.co/room' } },
        stage: { attrs: {} },
        stageTimer: { elapsed: 0 },
      },
      daily: {
        localSessionId: 'daily-123',
        participantIds: ['daily-123'],
        videoTracks: { 'daily-123': { isOff: false, subscribed: true } },
        audioTracks: { 'daily-123': { isOff: false, subscribed: true } },
      },
    },
  });

  // Verify component rendered with tiles
  await expect(component.locator('[data-test="callTile"]')).toBeVisible({ timeout: 5000 });
});
