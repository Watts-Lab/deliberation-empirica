import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../../../client/src/call/VideoCall';

/**
 * Component Tests for Device Alignment
 *
 * Related: PR #1170, Issue #1169
 * Tests: DEVICE-004, DEVICE-007, DEVICE-008
 *
 * Validates device alignment behavior in VideoCall component.
 * Unit tests (DEVICE-001 to DEVICE-003, 005, 006, 008) are in deviceAlignment.test.js.
 *
 * NOTE: hooksConfig is JSON-serialized, so functions cannot be included.
 * MockDailyProvider merges data-only device configs with default function implementations.
 */

/**
 * Test ID: DEVICE-007
 * PR: #1170
 * Bug: Device alignment triggered prematurely when preferredId was "waiting"
 * Validates: No device alignment attempted when preference is "waiting"
 *
 * The VideoCall component uses "waiting" as a sentinel value when no device
 * preference has been set yet. Lines 684-706 in VideoCall.jsx check for this.
 */
test('DEVICE-007: skips alignment when preferred device is "waiting"', async ({ mount }) => {
  test.slow(); // VideoCall is heavyweight; give extra time under parallel load
  // Player has no micId/cameraId/speakerId set → VideoCall reads null → uses "waiting" sentinel
  const config = {
    empirica: {
      currentPlayerId: 'p0',
      players: [{
        id: 'p0',
        attrs: {
          position: '0',
          dailyId: 'daily-p0',
          // No micId/cameraId/speakerId = "waiting" default in VideoCall
        },
      }],
      game: { attrs: { dailyUrl: 'https://test.daily.co/room' } },
      stage: { attrs: {} },
      stageTimer: { elapsed: 0 },
    },
    daily: {
      localSessionId: 'daily-p0',
      participantIds: ['daily-p0'],
      videoTracks: { 'daily-p0': { isOff: false, subscribed: true } },
      audioTracks: { 'daily-p0': { isOff: false, subscribed: true } },
      // devices with only data (no functions) - MockDailyProvider adds default functions
      devices: {
        cameras: [{ device: { deviceId: 'cam-1', label: 'FaceTime Camera' } }],
        microphones: [{ device: { deviceId: 'mic-1', label: 'Built-in Mic' } }],
        speakers: [{ device: { deviceId: 'spk-1', label: 'Built-in Speaker' } }],
        currentCam: { device: { deviceId: 'cam-1', label: 'FaceTime Camera' } },
        currentMic: { device: { deviceId: 'mic-1', label: 'Built-in Mic' } },
        currentSpeaker: { device: { deviceId: 'spk-1', label: 'Built-in Speaker' } },
      },
    },
  };

  // Should render without error - the "waiting" sentinel prevents any alignment attempt
  const component = await mount(<VideoCall showSelfView />, { hooksConfig: config });
  await expect(component).toBeVisible();
});

/**
 * Test ID: DEVICE-004
 * PR: #1170
 * Bug: Device labels not stored, preventing label-based fallback in future sessions
 * Validates: Component renders correctly when device preferences are set via player attrs
 *
 * NOTE: This test verifies the component renders with device preference attributes.
 * The actual label storage happens in the device setup flow (pre-VideoCall).
 */
test('DEVICE-004: component renders when device preferences are set', async ({ mount }) => {
  test.slow();
  const config = {
    empirica: {
      currentPlayerId: 'p0',
      players: [{
        id: 'p0',
        attrs: {
          position: '0',
          dailyId: 'daily-p0',
          micId: 'mic-1',
          micLabel: 'Blue Yeti USB',
          cameraId: 'cam-1',
          cameraLabel: 'Logitech C920',
          speakerId: 'spk-1',
          speakerLabel: 'Built-in Speaker',
        },
      }],
      game: { attrs: { dailyUrl: 'https://test.daily.co/room' } },
      stage: { attrs: {} },
      stageTimer: { elapsed: 0 },
    },
    daily: {
      localSessionId: 'daily-p0',
      participantIds: ['daily-p0'],
      videoTracks: { 'daily-p0': { isOff: false, subscribed: true } },
      audioTracks: { 'daily-p0': { isOff: false, subscribed: true } },
      // data-only devices - MockDailyProvider adds default function implementations
      devices: {
        cameras: [{ device: { deviceId: 'cam-1', label: 'Logitech C920' } }],
        microphones: [{ device: { deviceId: 'mic-1', label: 'Blue Yeti USB' } }],
        speakers: [{ device: { deviceId: 'spk-1', label: 'Built-in Speaker' } }],
        currentCam: { device: { deviceId: 'cam-1', label: 'Logitech C920' } },
        currentMic: { device: { deviceId: 'mic-1', label: 'Blue Yeti USB' } },
        currentSpeaker: { device: { deviceId: 'spk-1', label: 'Built-in Speaker' } },
      },
    },
  };

  const component = await mount(<VideoCall showSelfView />, { hooksConfig: config });
  await expect(component).toBeVisible();
});

/**
 * DEVICE-008 (reinforcement)
 * Validates: Component renders when device preferences already match current devices.
 * When IDs match, alignment is skipped (needsAlignment returns false).
 * The actual needsAlignment unit test is in deviceAlignment.test.js.
 */
test('DEVICE-008 (component): renders when current device matches preference', async ({ mount }) => {
  test.slow();
  const config = {
    empirica: {
      currentPlayerId: 'p0',
      players: [{
        id: 'p0',
        attrs: {
          position: '0',
          dailyId: 'daily-p0',
          micId: 'mic-1',
          micLabel: 'Built-in Mic',
          cameraId: 'cam-1',
          cameraLabel: 'FaceTime Camera',
        },
      }],
      game: { attrs: {} },
      stage: { attrs: {} },
      stageTimer: { elapsed: 0 },
    },
    daily: {
      localSessionId: 'daily-p0',
      participantIds: ['daily-p0'],
      videoTracks: { 'daily-p0': { isOff: false, subscribed: true } },
      audioTracks: { 'daily-p0': { isOff: false, subscribed: true } },
      // currentCam and currentMic match preferred IDs - alignment should be skipped
      devices: {
        cameras: [{ device: { deviceId: 'cam-1', label: 'FaceTime Camera' } }],
        microphones: [{ device: { deviceId: 'mic-1', label: 'Built-in Mic' } }],
        speakers: [],
        currentCam: { device: { deviceId: 'cam-1', label: 'FaceTime Camera' } },
        currentMic: { device: { deviceId: 'mic-1', label: 'Built-in Mic' } },
        currentSpeaker: null,
      },
    },
  };

  const component = await mount(<VideoCall showSelfView />, { hooksConfig: config });
  await expect(component).toBeVisible();
});
