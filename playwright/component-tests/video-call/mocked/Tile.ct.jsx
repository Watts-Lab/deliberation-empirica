import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { Tile } from '../../../../client/src/call/Tile';

/**
 * Component Tests for Tile UI States
 *
 * Related: PR #1132, PR #1134
 * Tests: TILE-001 to TILE-005, SELF-001 to SELF-004
 *
 * These tests verify correct visual states for participant tiles under
 * different connection and media conditions.
 */

/**
 * Test ID: TILE-001
 * PR: #1132, #1134
 * Bug: Tiles show incorrect states for subscribed/unsubscribed participants
 * Validates: Video element visible when playable
 */
test('TILE-001: shows video when playable', async ({ mount }) => {
  const component = await mount(<Tile source={{ type: 'participant', position: '1' }} media={{ video: true }} pixels={{ width: 320, height: 240 }} />, {
    hooksConfig: {
      empirica: {
        currentPlayerId: 'p0',
        players: [
          { id: 'p0', attrs: { position: '0', dailyId: 'daily-p0' } },
          { id: 'p1', attrs: { position: '1', dailyId: 'daily-p1' } },
        ],
        game: { attrs: {} },
        stage: { attrs: {} },
      },
      daily: {
        localSessionId: 'daily-p0',
        participantIds: ['daily-p0', 'daily-p1'],
        videoTracks: {
          'daily-p1': { isOff: false, subscribed: true },
        },
        audioTracks: {
          'daily-p1': { isOff: false, subscribed: true },
        },
      },
    },
  });

  // Should NOT show waiting message
  await expect(component.locator('[data-test="waitingParticipantTile"]')).not.toBeVisible();

  // Should NOT show video muted message
  await expect(component.locator('[data-test="videoMutedTile"]')).not.toBeVisible();

  // Note: DailyVideo component won't actually render in mock tests,
  // but we can verify the negative cases (no waiting/muted messages)
});

/**
 * Test ID: TILE-002
 * PR: #1134
 * Bug: Video muted tiles showed "waiting" instead of "Video Muted"
 * Validates: Shows "Video Muted" overlay when video off but subscribed
 */
test('TILE-002: shows "Video Muted" when off', async ({ mount }) => {
  const component = await mount(<Tile source={{ type: 'participant', position: '1' }} media={{ video: true }} pixels={{ width: 320, height: 240 }} />, {
    hooksConfig: {
      empirica: {
        currentPlayerId: 'p0',
        players: [
          { id: 'p0', attrs: { position: '0', dailyId: 'daily-p0' } },
          { id: 'p1', attrs: { position: '1', dailyId: 'daily-p1' } },
        ],
        game: { attrs: {} },
        stage: { attrs: {} },
      },
      daily: {
        localSessionId: 'daily-p0',
        participantIds: ['daily-p0', 'daily-p1'],
        videoTracks: {
          'daily-p1': { isOff: true, subscribed: true }, // Muted but subscribed
        },
        audioTracks: {
          'daily-p1': { isOff: false, subscribed: true },
        },
      },
    },
  });

  // Should show "Video Muted" message
  const videoMutedTile = component.locator('[data-test="videoMutedTile"]');
  await expect(videoMutedTile).toBeVisible();
  await expect(videoMutedTile).toContainText('Video Muted');

  // Should NOT show waiting message
  await expect(component.locator('[data-test="waitingParticipantTile"]')).not.toBeVisible();
});

/**
 * Test ID: TILE-003
 * PR: #1132
 * Bug: Unsubscribed participants didn't show waiting message
 * Validates: Shows "Waiting" message when not subscribed
 */
test('TILE-003: shows "Waiting" when unsubscribed', async ({ mount }) => {
  const component = await mount(<Tile source={{ type: 'participant', position: '1' }} media={{ video: true }} pixels={{ width: 320, height: 240 }} />, {
    hooksConfig: {
      empirica: {
        currentPlayerId: 'p0',
        players: [
          { id: 'p0', attrs: { position: '0', dailyId: 'daily-p0' } },
          { id: 'p1', attrs: { position: '1', dailyId: 'daily-p1' } },
        ],
        game: { attrs: {} },
        stage: { attrs: {} },
      },
      daily: {
        localSessionId: 'daily-p0',
        participantIds: ['daily-p0', 'daily-p1'],
        videoTracks: {
          'daily-p1': { isOff: false, subscribed: false }, // Not subscribed yet
        },
        audioTracks: {
          'daily-p1': { isOff: false, subscribed: false },
        },
      },
    },
  });

  // Should show waiting message
  const waitingTile = component.locator('[data-test="waitingParticipantTile"]');
  await expect(waitingTile).toBeVisible();
  await expect(waitingTile).toContainText('Waiting for participant to connect');

  // Should NOT show video muted message
  await expect(component.locator('[data-test="videoMutedTile"]')).not.toBeVisible();
});

/**
 * Test ID: TILE-004
 * PR: #1132
 * Bug: Audio mute badge not consistently shown
 * Validates: Audio muted badge visible when audio off
 */
test('TILE-004: shows audio muted badge', async ({ mount }) => {
  const component = await mount(<Tile source={{ type: 'participant', position: '1' }} media={{ video: true }} pixels={{ width: 320, height: 240 }} />, {
    hooksConfig: {
      empirica: {
        currentPlayerId: 'p0',
        players: [
          { id: 'p0', attrs: { position: '0', dailyId: 'daily-p0' } },
          { id: 'p1', attrs: { position: '1', dailyId: 'daily-p1' } },
        ],
        game: { attrs: {} },
        stage: { attrs: {} },
      },
      daily: {
        localSessionId: 'daily-p0',
        participantIds: ['daily-p0', 'daily-p1'],
        videoTracks: {
          'daily-p1': { isOff: false, subscribed: true },
        },
        audioTracks: {
          'daily-p1': { isOff: true, subscribed: true }, // Audio muted
        },
      },
    },
  });

  // Should show audio muted badge with accessible label
  const muteBadge = component.locator('[aria-label="Participant muted"]');
  await expect(muteBadge).toBeVisible();
});

/**
 * Test ID: TILE-005
 * PR: #1134
 * Bug: Nicknames not displayed correctly on tiles
 * Validates: Nickname displayed when participant has username
 */
test('TILE-005: shows nickname when enabled', async ({ mount }) => {
  const component = await mount(<Tile source={{ type: 'participant', position: '1' }} media={{ video: true }} pixels={{ width: 320, height: 240 }} />, {
    hooksConfig: {
      empirica: {
        currentPlayerId: 'p0',
        players: [
          { id: 'p0', attrs: { position: '0', dailyId: 'daily-p0' } },
          { id: 'p1', attrs: { position: '1', dailyId: 'daily-p1' } },
        ],
        game: { attrs: {} },
        stage: { attrs: {} },
      },
      daily: {
        localSessionId: 'daily-p0',
        participantIds: ['daily-p0', 'daily-p1'],
        videoTracks: {
          'daily-p1': { isOff: false, subscribed: true },
        },
        audioTracks: {
          'daily-p1': { isOff: false, subscribed: true },
        },
        participants: {
          'daily-p1': { user_name: 'Alice' },
        },
      },
    },
  });

  // Should show username
  await expect(component.locator('text=Alice')).toBeVisible();
});

/**
 * Test ID: SELF-001
 * PR: #1134
 * Bug: Self-view showed "Waiting for participant" instead of video
 * Validates: Self-view shows video when camera on
 */
test('SELF-001: self-view shows video', async ({ mount }) => {
  const component = await mount(<Tile source={{ type: 'self' }} media={{ video: true }} pixels={{ width: 320, height: 240 }} />, {
    hooksConfig: {
      empirica: {
        currentPlayerId: 'p0',
        players: [
          { id: 'p0', attrs: { position: '0', dailyId: 'daily-p0' } },
        ],
        game: { attrs: {} },
        stage: { attrs: {} },
      },
      daily: {
        localSessionId: 'daily-p0',
        participantIds: ['daily-p0'],
        videoTracks: {
          'daily-p0': { isOff: false }, // No subscribed field for local
        },
        audioTracks: {
          'daily-p0': { isOff: false },
        },
      },
    },
  });

  // Should NOT show waiting message (bug was showing waiting for self-view)
  await expect(component.locator('[data-test="waitingParticipantTile"]')).not.toBeVisible();

  // Should NOT show video muted message
  await expect(component.locator('[data-test="videoMutedTile"]')).not.toBeVisible();
});

/**
 * Test ID: SELF-002
 * PR: #1134
 * Bug: Self-view with camera off showed "Waiting" instead of "Video Muted"
 * Validates: Self-view shows "Video Muted" when camera off
 */
test('SELF-002: self-view shows "Video Muted"', async ({ mount }) => {
  const component = await mount(<Tile source={{ type: 'self' }} media={{ video: true }} pixels={{ width: 320, height: 240 }} />, {
    hooksConfig: {
      empirica: {
        currentPlayerId: 'p0',
        players: [
          { id: 'p0', attrs: { position: '0', dailyId: 'daily-p0' } },
        ],
        game: { attrs: {} },
        stage: { attrs: {} },
      },
      daily: {
        localSessionId: 'daily-p0',
        participantIds: ['daily-p0'],
        videoTracks: {
          'daily-p0': { isOff: true }, // Camera off, local track
        },
        audioTracks: {
          'daily-p0': { isOff: false },
        },
      },
    },
  });

  // Should show "Video Muted" message
  const videoMutedTile = component.locator('[data-test="videoMutedTile"]');
  await expect(videoMutedTile).toBeVisible();
  await expect(videoMutedTile).toContainText('Video Muted');

  // Should NOT show waiting message
  await expect(component.locator('[data-test="waitingParticipantTile"]')).not.toBeVisible();
});

/**
 * Test ID: SELF-003
 * PR: #1134
 * Bug: Self-view incorrectly checked subscription status
 * Validates: Local tiles don't check subscription (always treated as subscribed)
 */
test('SELF-003: skips subscription check for local', async ({ mount }) => {
  // This test validates the logic fix in Tile.jsx lines 39-44 and 48-50
  // Local tiles set isVideoSubscribed and isAudioSubscribed to true regardless of subscribed property

  const component = await mount(<Tile source={{ type: 'self' }} media={{ video: true }} pixels={{ width: 320, height: 240 }} />, {
    hooksConfig: {
      empirica: {
        currentPlayerId: 'p0',
        players: [
          { id: 'p0', attrs: { position: '0', dailyId: 'daily-p0' } },
        ],
        game: { attrs: {} },
        stage: { attrs: {} },
      },
      daily: {
        localSessionId: 'daily-p0',
        participantIds: ['daily-p0'],
        videoTracks: {
          // Note: No subscribed field, or even subscribed: false would be ignored for local
          'daily-p0': { isOff: false, subscribed: false },
        },
        audioTracks: {
          'daily-p0': { isOff: false, subscribed: false },
        },
      },
    },
  });

  // Should NOT show waiting message even though subscribed: false
  // because local tiles skip subscription check
  await expect(component.locator('[data-test="waitingParticipantTile"]')).not.toBeVisible();
});

/**
 * Test ID: SELF-004
 * PR: #1134
 * Bug: Remote tiles showed video even when not subscribed
 * Validates: Remote tile shows "Waiting" correctly when not subscribed
 */
test('SELF-004: remote tile shows "Waiting" correctly', async ({ mount }) => {
  // Test that remote tiles (non-self) DO check subscription status

  const component = await mount(<Tile source={{ type: 'participant', position: '1' }} media={{ video: true }} pixels={{ width: 320, height: 240 }} />, {
    hooksConfig: {
      empirica: {
        currentPlayerId: 'p0',
        players: [
          { id: 'p0', attrs: { position: '0', dailyId: 'daily-p0' } },
          { id: 'p1', attrs: { position: '1', dailyId: 'daily-p1' } },
        ],
        game: { attrs: {} },
        stage: { attrs: {} },
      },
      daily: {
        localSessionId: 'daily-p0',
        participantIds: ['daily-p0', 'daily-p1'],
        videoTracks: {
          'daily-p1': { isOff: false, subscribed: false }, // Video available but not subscribed
        },
        audioTracks: {
          'daily-p1': { isOff: false, subscribed: false },
        },
      },
    },
  });

  // Should show waiting message for remote tile when not subscribed
  const waitingTile = component.locator('[data-test="waitingParticipantTile"]');
  await expect(waitingTile).toBeVisible();
  await expect(waitingTile).toContainText('Waiting for participant to connect');
});
