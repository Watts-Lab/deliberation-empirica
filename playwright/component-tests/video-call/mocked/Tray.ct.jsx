import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { Tray } from '../../../../client/src/call/Tray';

/**
 * Component Tests for Tray UI
 * Related: PR #1140
 * Tests: TRAY-001 to TRAY-006
 */

const defaultPlayerConfig = {
  empirica: {
    currentPlayerId: 'p0',
    players: [{ id: 'p0', attrs: { name: 'Test User', position: '0', dailyId: 'daily-p0' } }],
    game: { attrs: {} },
    stage: { attrs: {} },
  },
  daily: {
    localSessionId: 'daily-p0',
    participantIds: ['daily-p0'],
    videoTracks: { 'daily-p0': { isOff: false, subscribed: true } },
    audioTracks: { 'daily-p0': { isOff: false, subscribed: true } },
  },
};

const mutedVideoConfig = {
  ...defaultPlayerConfig,
  daily: {
    ...defaultPlayerConfig.daily,
    videoTracks: { 'daily-p0': { isOff: true, subscribed: true } },
  },
};

const mutedAudioConfig = {
  ...defaultPlayerConfig,
  daily: {
    ...defaultPlayerConfig.daily,
    audioTracks: { 'daily-p0': { isOff: true, subscribed: true } },
  },
};

/** TRAY-001: Fix A/V button visible */
test('TRAY-001: Fix A/V button visible', async ({ mount }) => {
  const component = await mount(
    <Tray showReportMissing player={null} stageElapsed={0} progressLabel="test" audioContext={null} resumeAudioContext={() => Promise.resolve()} />,
    { hooksConfig: defaultPlayerConfig }
  );
  await expect(component.locator('[data-test="fixAV"]')).toBeVisible();
  await expect(component.locator('[data-test="fixAV"]')).toContainText('Fix Audio/Video');
});

/** TRAY-002: Camera toggle shows "Disable camera" when on */
test('TRAY-002: camera toggle shows disable when camera on', async ({ mount }) => {
  const component = await mount(
    <Tray showReportMissing player={null} stageElapsed={0} progressLabel="test" audioContext={null} resumeAudioContext={() => Promise.resolve()} />,
    { hooksConfig: defaultPlayerConfig }
  );
  await expect(component.locator('[data-test="toggleVideo"]')).toContainText('Disable camera');
});

/** TRAY-002b: Camera button shows "Enable camera" when muted */
test('TRAY-002b: camera button shows enable when muted', async ({ mount }) => {
  const component = await mount(
    <Tray showReportMissing player={null} stageElapsed={0} progressLabel="test" audioContext={null} resumeAudioContext={() => Promise.resolve()} />,
    { hooksConfig: mutedVideoConfig }
  );
  await expect(component.locator('[data-test="toggleVideo"]')).toContainText('Enable camera');
});

/** TRAY-003: Mic button shows "Mute mic" when mic on */
test('TRAY-003: mic button shows mute when mic on', async ({ mount }) => {
  const component = await mount(
    <Tray showReportMissing player={null} stageElapsed={0} progressLabel="test" audioContext={null} resumeAudioContext={() => Promise.resolve()} />,
    { hooksConfig: defaultPlayerConfig }
  );
  await expect(component.locator('[data-test="toggleAudio"]')).toContainText('Mute mic');
});

/** TRAY-003b: Mic button shows "Unmute mic" when muted */
test('TRAY-003b: mic button shows unmute when muted', async ({ mount }) => {
  const component = await mount(
    <Tray showReportMissing player={null} stageElapsed={0} progressLabel="test" audioContext={null} resumeAudioContext={() => Promise.resolve()} />,
    { hooksConfig: mutedAudioConfig }
  );
  await expect(component.locator('[data-test="toggleAudio"]')).toContainText('Unmute mic');
});

/** TRAY-006: Missing Participant button visible */
test('TRAY-006: Missing Participant button visible', async ({ mount }) => {
  const component = await mount(
    <Tray showReportMissing player={null} stageElapsed={0} progressLabel="test" audioContext={null} resumeAudioContext={() => Promise.resolve()} />,
    { hooksConfig: defaultPlayerConfig }
  );
  await expect(component.locator('[data-test="reportMissing"]')).toBeVisible();
  await expect(component.locator('[data-test="reportMissing"]')).toContainText('Missing Participant');
});

/** TRAY-006b: Missing Participant button hidden when disabled */
test('TRAY-006b: Missing Participant button hidden when disabled', async ({ mount }) => {
  const component = await mount(
    <Tray showReportMissing={false} player={null} stageElapsed={0} progressLabel="test" audioContext={null} resumeAudioContext={() => Promise.resolve()} />,
    { hooksConfig: defaultPlayerConfig }
  );
  await expect(component.locator('[data-test="reportMissing"]')).not.toBeVisible();
});
