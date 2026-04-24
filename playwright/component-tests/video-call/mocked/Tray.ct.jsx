import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { Tray } from "../../../../client/src/components/discussion/call/Tray";

/**
 * Component Tests for Tray UI
 * Related: PR #1140
 * Tests: TRAY-001 to TRAY-006
 */

const defaultPlayerConfig = {
  empirica: {
    currentPlayerId: "p0",
    players: [
      {
        id: "p0",
        attrs: { name: "Test User", position: "0", dailyId: "daily-p0" },
      },
    ],
    game: { attrs: {} },
    stage: { attrs: {} },
  },
  daily: {
    localSessionId: "daily-p0",
    participantIds: ["daily-p0"],
    videoTracks: { "daily-p0": { isOff: false, subscribed: true } },
    audioTracks: { "daily-p0": { isOff: false, subscribed: true } },
  },
};

const mutedVideoConfig = {
  ...defaultPlayerConfig,
  daily: {
    ...defaultPlayerConfig.daily,
    videoTracks: { "daily-p0": { isOff: true, subscribed: true } },
  },
};

const mutedAudioConfig = {
  ...defaultPlayerConfig,
  daily: {
    ...defaultPlayerConfig.daily,
    audioTracks: { "daily-p0": { isOff: true, subscribed: true } },
  },
};

/** TRAY-001: Fix A/V button visible */
test("TRAY-001: Fix A/V button visible", async ({ mount }) => {
  const component = await mount(
    <Tray
      showReportMissing
      player={null}
      stageElapsed={0}
      progressLabel="test"
      audioContext={null}
      resumeAudioContext={() => Promise.resolve()}
    />,
    { hooksConfig: defaultPlayerConfig },
  );
  await expect(component.locator('[data-testid="fixAV"]')).toBeVisible();
  await expect(component.locator('[data-testid="fixAV"]')).toContainText(
    "Fix Audio/Video",
  );
});

/** TRAY-002: Camera toggle shows "Disable camera" when on */
test("TRAY-002: camera toggle shows disable when camera on", async ({
  mount,
}) => {
  const component = await mount(
    <Tray
      showReportMissing
      player={null}
      stageElapsed={0}
      progressLabel="test"
      audioContext={null}
      resumeAudioContext={() => Promise.resolve()}
    />,
    { hooksConfig: defaultPlayerConfig },
  );
  await expect(component.locator('[data-testid="toggleVideo"]')).toContainText(
    "Disable camera",
  );
});

/** TRAY-002b: Camera button shows "Enable camera" when muted */
test("TRAY-002b: camera button shows enable when muted", async ({ mount }) => {
  const component = await mount(
    <Tray
      showReportMissing
      player={null}
      stageElapsed={0}
      progressLabel="test"
      audioContext={null}
      resumeAudioContext={() => Promise.resolve()}
    />,
    { hooksConfig: mutedVideoConfig },
  );
  await expect(component.locator('[data-testid="toggleVideo"]')).toContainText(
    "Enable camera",
  );
});

/** TRAY-003: Mic button shows "Mute mic" when mic on */
test("TRAY-003: mic button shows mute when mic on", async ({ mount }) => {
  const component = await mount(
    <Tray
      showReportMissing
      player={null}
      stageElapsed={0}
      progressLabel="test"
      audioContext={null}
      resumeAudioContext={() => Promise.resolve()}
    />,
    { hooksConfig: defaultPlayerConfig },
  );
  await expect(component.locator('[data-testid="toggleAudio"]')).toContainText(
    "Mute mic",
  );
});

/** TRAY-003b: Mic button shows "Unmute mic" when muted */
test("TRAY-003b: mic button shows unmute when muted", async ({ mount }) => {
  const component = await mount(
    <Tray
      showReportMissing
      player={null}
      stageElapsed={0}
      progressLabel="test"
      audioContext={null}
      resumeAudioContext={() => Promise.resolve()}
    />,
    { hooksConfig: mutedAudioConfig },
  );
  await expect(component.locator('[data-testid="toggleAudio"]')).toContainText(
    "Unmute mic",
  );
});

/** TRAY-006: Missing Participant button visible */
test("TRAY-006: Missing Participant button visible", async ({ mount }) => {
  const component = await mount(
    <Tray
      showReportMissing
      player={null}
      stageElapsed={0}
      progressLabel="test"
      audioContext={null}
      resumeAudioContext={() => Promise.resolve()}
    />,
    { hooksConfig: defaultPlayerConfig },
  );
  await expect(
    component.locator('[data-testid="reportMissing"]'),
  ).toBeVisible();
  await expect(
    component.locator('[data-testid="reportMissing"]'),
  ).toContainText("Missing Participant");
});

/** TRAY-006b: Missing Participant button hidden when disabled */
test("TRAY-006b: Missing Participant button hidden when disabled", async ({
  mount,
}) => {
  const component = await mount(
    <Tray
      showReportMissing={false}
      player={null}
      stageElapsed={0}
      progressLabel="test"
      audioContext={null}
      resumeAudioContext={() => Promise.resolve()}
    />,
    { hooksConfig: defaultPlayerConfig },
  );
  await expect(
    component.locator('[data-testid="reportMissing"]'),
  ).not.toBeVisible();
});

/**
 * TRAY-007: video + audio mute buttons hidden when both are disabled
 *
 * Covers cypress 16 "Stage 6: Hide Mute Controls" — a layout stage where
 * both mute toggles are hidden but fixAV / reportMissing remain visible.
 */
test("TRAY-007: toggleVideo + toggleAudio hidden when both showMute=false", async ({
  mount,
}) => {
  const component = await mount(
    <Tray
      showReportMissing
      showAudioMute={false}
      showVideoMute={false}
      player={null}
      stageElapsed={0}
      progressLabel="test"
      audioContext={null}
      resumeAudioContext={() => Promise.resolve()}
    />,
    { hooksConfig: defaultPlayerConfig },
  );
  await expect(
    component.locator('[data-testid="toggleVideo"]'),
  ).not.toBeVisible();
  await expect(
    component.locator('[data-testid="toggleAudio"]'),
  ).not.toBeVisible();
  // fixAV and reportMissing should still be present
  await expect(component.locator('[data-testid="fixAV"]')).toBeVisible();
  await expect(
    component.locator('[data-testid="reportMissing"]'),
  ).toBeVisible();
});

/** TRAY-007a: only video mute hidden */
test("TRAY-007a: showVideoMute=false hides camera button only", async ({
  mount,
}) => {
  const component = await mount(
    <Tray
      showReportMissing
      showVideoMute={false}
      player={null}
      stageElapsed={0}
      progressLabel="test"
      audioContext={null}
      resumeAudioContext={() => Promise.resolve()}
    />,
    { hooksConfig: defaultPlayerConfig },
  );
  await expect(
    component.locator('[data-testid="toggleVideo"]'),
  ).not.toBeVisible();
  await expect(component.locator('[data-testid="toggleAudio"]')).toBeVisible();
});

/** TRAY-007b: only audio mute hidden */
test("TRAY-007b: showAudioMute=false hides mic button only", async ({
  mount,
}) => {
  const component = await mount(
    <Tray
      showReportMissing
      showAudioMute={false}
      player={null}
      stageElapsed={0}
      progressLabel="test"
      audioContext={null}
      resumeAudioContext={() => Promise.resolve()}
    />,
    { hooksConfig: defaultPlayerConfig },
  );
  await expect(component.locator('[data-testid="toggleVideo"]')).toBeVisible();
  await expect(
    component.locator('[data-testid="toggleAudio"]'),
  ).not.toBeVisible();
});
