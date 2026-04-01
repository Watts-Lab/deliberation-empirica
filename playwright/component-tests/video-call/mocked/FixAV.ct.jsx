import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { Tray } from "../../../../client/src/call/Tray";

/**
 * Component Tests for FixAV Modal
 * Related: PR #1171, Issue #1166, PR #1202 (enhanced Fix A/V panel)
 * Tests: FIXAV-001 to FIXAV-029
 *
 * Tests the Fix A/V modal workflow via the Tray component which embeds useFixAV.
 *
 * Modal layout (PR #1202):
 * - Top: Device management (camera/mic/speaker pickers) — always visible
 * - Bottom: Diagnostics section — collapsed by default, expand via "Having trouble?"
 */

const twoPlayerConfig = {
  empirica: {
    currentPlayerId: "p0",
    players: [
      {
        id: "p0",
        attrs: { name: "Player 0", position: "0", dailyId: "daily-p0" },
      },
      {
        id: "p1",
        attrs: { name: "Player 1", position: "1", dailyId: "daily-p1" },
      },
    ],
    game: { attrs: {} },
    stage: { attrs: {} },
  },
  daily: {
    localSessionId: "daily-p0",
    participantIds: ["daily-p0", "daily-p1"],
    videoTracks: {
      "daily-p0": { isOff: false, subscribed: true },
      "daily-p1": { isOff: false, subscribed: true },
    },
    audioTracks: {
      "daily-p0": { isOff: false, subscribed: true },
      "daily-p1": { isOff: false, subscribed: true },
    },
  },
};

// Config with device list — required for microphoneTrackEnded/cameraTrackEnded fix
// (avRecovery.attemptSoftFixes checks devices.microphones/cameras.length > 0)
// Device objects use Daily's format: { device: { deviceId, label } }
const twoPlayerConfigWithDevices = {
  empirica: {
    currentPlayerId: "p0",
    players: [
      {
        id: "p0",
        attrs: { name: "Player 0", position: "0", dailyId: "daily-p0" },
      },
      {
        id: "p1",
        attrs: { name: "Player 1", position: "1", dailyId: "daily-p1" },
      },
    ],
    game: { attrs: {} },
    stage: { attrs: {} },
  },
  daily: {
    localSessionId: "daily-p0",
    participantIds: ["daily-p0", "daily-p1"],
    videoTracks: {
      "daily-p0": { isOff: false, subscribed: true },
      "daily-p1": { isOff: false, subscribed: true },
    },
    audioTracks: {
      "daily-p0": { isOff: false, subscribed: true },
      "daily-p1": { isOff: false, subscribed: true },
    },
    devices: {
      microphones: [
        { device: { deviceId: "default-mic", label: "Default Microphone" } },
      ],
      cameras: [
        { device: { deviceId: "default-cam", label: "Default Camera" } },
      ],
      speakers: [
        { device: { deviceId: "default-speaker", label: "Default Speaker" } },
      ],
    },
  },
};

// Config with multiple devices per type — for device picker tests
const configWithMultipleDevices = {
  empirica: {
    currentPlayerId: "p0",
    players: [
      {
        id: "p0",
        attrs: { name: "Player 0", position: "0", dailyId: "daily-p0" },
      },
      {
        id: "p1",
        attrs: { name: "Player 1", position: "1", dailyId: "daily-p1" },
      },
    ],
    game: { attrs: {} },
    stage: { attrs: {} },
  },
  daily: {
    localSessionId: "daily-p0",
    participantIds: ["daily-p0", "daily-p1"],
    videoTracks: {
      "daily-p0": { isOff: false, subscribed: true },
      "daily-p1": { isOff: false, subscribed: true },
    },
    audioTracks: {
      "daily-p0": { isOff: false, subscribed: true },
      "daily-p1": { isOff: false, subscribed: true },
    },
    devices: {
      cameras: [
        { device: { deviceId: "cam-1", label: "Built-in Camera" } },
        { device: { deviceId: "cam-2", label: "USB Webcam" } },
      ],
      microphones: [
        { device: { deviceId: "mic-1", label: "Built-in Microphone" } },
        { device: { deviceId: "mic-2", label: "USB Microphone" } },
      ],
      speakers: [
        { device: { deviceId: "spk-1", label: "Built-in Speaker" } },
        { device: { deviceId: "spk-2", label: "Headphones" } },
      ],
      currentCam: { device: { deviceId: "cam-1", label: "Built-in Camera" } },
      currentMic: {
        device: { deviceId: "mic-1", label: "Built-in Microphone" },
      },
      currentSpeaker: {
        device: { deviceId: "spk-1", label: "Built-in Speaker" },
      },
    },
  },
};

const trayProps = {
  showReportMissing: true,
  player: null,
  stageElapsed: 0,
  progressLabel: "test",
  audioContext: null,
  resumeAudioContext: () => Promise.resolve(),
};

/**
 * Helper: open Fix A/V modal and expand the diagnostics section.
 * The diagnostics section (issue checkboxes, Diagnose & Fix button) is collapsed
 * by default in the enhanced modal. This helper expands it.
 */
async function openFixAVAndExpandDiagnostics(component) {
  await component.locator('[data-testid="fixAV"]').click();
  await component.locator('[data-testid="expandDiagnostics"]').click();
}

// ---------------------------------------------------------------------------
// Device management section tests (PR #1202)
// ---------------------------------------------------------------------------

/** FIXAV-020: Device pickers visible when modal opens */
test("FIXAV-020: device pickers visible when modal opens", async ({
  mount,
}) => {
  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: configWithMultipleDevices,
  });
  await component.locator('[data-testid="fixAV"]').click();
  await expect(
    component.locator('[data-testid="deviceManagement"]')
  ).toBeVisible();
  await expect(component.locator("text=Manage Devices")).toBeVisible();
});

/** FIXAV-021: Camera picker lists available cameras */
test("FIXAV-021: camera picker lists available cameras", async ({ mount }) => {
  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: configWithMultipleDevices,
  });
  await component.locator('[data-testid="fixAV"]').click();
  const cameraSelect = component.locator('[data-testid="fixAVCameraSelect"]');
  await expect(cameraSelect).toBeVisible();
  await expect(cameraSelect.locator("option")).toHaveCount(2);
  await expect(cameraSelect.locator("option").first()).toHaveText(
    "Built-in Camera"
  );
  await expect(cameraSelect.locator("option").last()).toHaveText("USB Webcam");
});

/** FIXAV-023: Mic picker lists available microphones */
test("FIXAV-023: mic picker lists available microphones", async ({ mount }) => {
  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: configWithMultipleDevices,
  });
  await component.locator('[data-testid="fixAV"]').click();
  const micSelect = component.locator('[data-testid="fixAVMicSelect"]');
  await expect(micSelect).toBeVisible();
  await expect(micSelect.locator("option")).toHaveCount(2);
});

/** FIXAV-024: Speaker picker lists available speakers */
test("FIXAV-024: speaker picker lists available speakers", async ({
  mount,
}) => {
  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: configWithMultipleDevices,
  });
  await component.locator('[data-testid="fixAV"]').click();
  const speakerSelect = component.locator('[data-testid="fixAVSpeakerSelect"]');
  await expect(speakerSelect).toBeVisible();
  await expect(speakerSelect.locator("option")).toHaveCount(2);
});

/** FIXAV-025: Test sound button exists for speaker */
test("FIXAV-025: test sound button exists for speaker", async ({ mount }) => {
  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: configWithMultipleDevices,
  });
  await component.locator('[data-testid="fixAV"]').click();
  await expect(
    component.locator('[data-testid="fixAVTestSound"]')
  ).toBeVisible();
});

/** FIXAV-026: Diagnostics section is collapsed by default */
test("FIXAV-026: diagnostics section collapsed by default", async ({
  mount,
}) => {
  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: configWithMultipleDevices,
  });
  await component.locator('[data-testid="fixAV"]').click();
  // Diagnostics section should not be visible
  await expect(
    component.locator('[data-testid="diagnosticsSection"]')
  ).not.toBeVisible();
  // But the "Having trouble?" link should be
  await expect(
    component.locator('[data-testid="expandDiagnostics"]')
  ).toBeVisible();
});

/** FIXAV-027: Diagnostics section expands on click */
test("FIXAV-027: diagnostics section expands on click", async ({ mount }) => {
  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: configWithMultipleDevices,
  });
  await component.locator('[data-testid="fixAV"]').click();
  await component.locator('[data-testid="expandDiagnostics"]').click();
  await expect(
    component.locator('[data-testid="diagnosticsSection"]')
  ).toBeVisible();
  await expect(
    component.locator("text=What problems are you experiencing?")
  ).toBeVisible();
});

/** FIXAV-028: Self-view preview visible in modal */
test("FIXAV-028: self-view preview visible in modal", async ({ mount }) => {
  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: configWithMultipleDevices,
  });
  await component.locator('[data-testid="fixAV"]').click();
  await expect(
    component.locator('[data-testid="fixAVSelfView"]')
  ).toBeVisible();
});

/** FIXAV-029: Mic level indicator visible in modal */
test("FIXAV-029: mic level indicator visible in modal", async ({ mount }) => {
  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: configWithMultipleDevices,
  });
  await component.locator('[data-testid="fixAV"]').click();
  await expect(
    component.locator('[data-testid="fixAVMicLevel"]')
  ).toBeVisible();
});

// ---------------------------------------------------------------------------
// Diagnostics flow tests (updated for collapsible section)
// ---------------------------------------------------------------------------

/** FIXAV-001: Modal opens on Fix A/V click — diagnostics visible after expand */
test("FIXAV-001: modal opens on Fix A/V click", async ({ mount }) => {
  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: twoPlayerConfig,
  });
  await openFixAVAndExpandDiagnostics(component);
  await expect(
    component.locator("text=What problems are you experiencing?")
  ).toBeVisible();
  await expect(component.locator("text=Select all that apply")).toBeVisible();
});

/** FIXAV-002: Can select multiple issues */
test("FIXAV-002: can select multiple issues", async ({ mount }) => {
  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: twoPlayerConfig,
  });
  await openFixAVAndExpandDiagnostics(component);
  await component.locator("text=I can't hear other participants").click();
  await component.locator("text=Others can't hear me").click();
  await expect(component.locator('input[value="cant-hear"]')).toBeChecked();
  await expect(
    component.locator('input[value="others-cant-hear-me"]')
  ).toBeChecked();
});

/** FIXAV-003: Can select "cant-hear" issue type */
test("FIXAV-003: cant-hear option available and selectable", async ({
  mount,
}) => {
  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: twoPlayerConfig,
  });
  await openFixAVAndExpandDiagnostics(component);
  await component.locator("text=I can't hear other participants").click();
  await expect(component.locator('input[value="cant-hear"]')).toBeChecked();
});

/** FIXAV-004: All issue types available for selection */
test("FIXAV-004: all issue types available", async ({ mount }) => {
  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: twoPlayerConfig,
  });
  await openFixAVAndExpandDiagnostics(component);
  await expect(
    component.locator("text=I can't hear other participants")
  ).toBeVisible();
  await expect(
    component.locator("text=I can't see other participants")
  ).toBeVisible();
  await expect(component.locator("text=Others can't hear me")).toBeVisible();
  await expect(component.locator("text=Others can't see me")).toBeVisible();
  await expect(component.locator("text=Something else")).toBeVisible();
});

/** FIXAV-009: Cancel diagnostics collapses diagnostics section */
test("FIXAV-009: cancel closes diagnostics section", async ({ mount }) => {
  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: twoPlayerConfig,
  });
  await openFixAVAndExpandDiagnostics(component);
  await expect(
    component.locator("text=What problems are you experiencing?")
  ).toBeVisible();
  await component.locator("text=Cancel").click();
  await expect(
    component.locator("text=What problems are you experiencing?")
  ).not.toBeVisible();
});

/** FIXAV-010: Diagnose & Fix button disabled with no selection */
test("FIXAV-010: Diagnose button disabled when no issue selected", async ({
  mount,
}) => {
  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: twoPlayerConfig,
  });
  await openFixAVAndExpandDiagnostics(component);
  await expect(
    component.locator('button:has-text("Diagnose & Fix")')
  ).toBeDisabled();
});

/** FIXAV-010b: Diagnose & Fix button enabled after selection */
test("FIXAV-010b: Diagnose button enabled after selection", async ({
  mount,
}) => {
  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: twoPlayerConfig,
  });
  await openFixAVAndExpandDiagnostics(component);
  await component.locator("text=I can't hear other participants").click();
  await expect(
    component.locator('button:has-text("Diagnose & Fix")')
  ).toBeEnabled();
});

/** FIXAV-012: Issue checkboxes toggle correctly (deselect) */
test("FIXAV-012: issue checkbox deselects on second click", async ({
  mount,
}) => {
  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: twoPlayerConfig,
  });
  await openFixAVAndExpandDiagnostics(component);
  await component.locator("text=I can't hear other participants").click();
  await expect(component.locator('input[value="cant-hear"]')).toBeChecked();
  await component.locator("text=I can't hear other participants").click();
  await expect(component.locator('input[value="cant-hear"]')).not.toBeChecked();
});

/** FIXAV-013: Issue selection state persists across clicks */
test("FIXAV-013: multiple issue selections work independently", async ({
  mount,
}) => {
  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: twoPlayerConfig,
  });
  await openFixAVAndExpandDiagnostics(component);
  await component.locator("text=I can't hear other participants").click();
  await component.locator("text=Others can't hear me").click();
  await component.locator("text=Others can't see me").click();
  // Deselect one
  await component.locator("text=Others can't hear me").click();
  await expect(component.locator('input[value="cant-hear"]')).toBeChecked();
  await expect(
    component.locator('input[value="others-cant-hear-me"]')
  ).not.toBeChecked();
  await expect(
    component.locator('input[value="others-cant-see-me"]')
  ).toBeChecked();
});

/** FIXAV-002b: Validates modal re-opens fresh after canceling */
test("FIXAV-002b: modal resets after cancel and reopen", async ({ mount }) => {
  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: twoPlayerConfig,
  });
  // Open, expand diagnostics, select, cancel diagnostics
  await openFixAVAndExpandDiagnostics(component);
  await component.locator("text=I can't hear other participants").click();
  await component.locator("text=Cancel").click();
  // Re-expand — should be fresh
  await component.locator('[data-testid="expandDiagnostics"]').click();
  await expect(component.locator('input[value="cant-hear"]')).not.toBeChecked();
});

/**
 * FIXAV-011: Shows success state after AudioContext fix resolves
 *
 * Tests the full diagnosis→fix→validate flow using real timers.
 */
test("FIXAV-011: shows success state after AudioContext fix resolves", async ({
  mount,
  page,
}) => {
  test.slow();

  await page.evaluate(() => {
    window.__customAudioContext = true;
    let callCount = 0;
    window.AudioContext = function MockAudioContext() {
      callCount++;
      const state = callCount === 1 ? "suspended" : "running";
      return {
        state,
        addEventListener() {},
        removeEventListener() {},
        resume() {
          return Promise.resolve();
        },
        close() {
          return Promise.resolve();
        },
      };
    };
    window.webkitAudioContext = window.AudioContext;
  });

  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: twoPlayerConfig,
  });

  await openFixAVAndExpandDiagnostics(component);
  await component.locator("text=I can't hear other participants").click();
  await component.locator('button:has-text("Diagnose & Fix")').click();

  await expect(component.locator("text=Attempting to fix...")).toBeVisible({
    timeout: 5000,
  });
  await expect(component.locator("text=Issue resolved")).toBeVisible({
    timeout: 10000,
  });
  await expect(
    component.locator("text=This dialog will close automatically...")
  ).toBeVisible();
});

/**
 * FIXAV-005: Shows success state when mic is muted (microphoneMuted cause)
 */
test("FIXAV-005: shows success state when mic is muted and fix unmutes it", async ({
  mount,
  page,
}) => {
  test.slow();

  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: twoPlayerConfig,
  });
  await page.waitForFunction(() => !!window.mockCallObject, { timeout: 15000 });
  await page.evaluate(() => {
    window.mockCallObject._audioEnabled = false;
  });

  await openFixAVAndExpandDiagnostics(component);
  await component.locator("text=Others can't hear me").click();
  await component.locator('button:has-text("Diagnose & Fix")').click();

  await expect(component.locator("text=Attempting to fix...")).toBeVisible({
    timeout: 5000,
  });
  await expect(component.locator("text=Issue resolved")).toBeVisible({
    timeout: 10000,
  });
  await expect(
    component.locator("text=This dialog will close automatically...")
  ).toBeVisible();
});

/**
 * FIXAV-007: Shows success state when camera is muted (cameraMuted cause)
 */
test("FIXAV-007: shows success state when camera is muted and fix turns it on", async ({
  mount,
  page,
}) => {
  test.slow();

  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: twoPlayerConfig,
  });
  await page.waitForFunction(() => !!window.mockCallObject, { timeout: 15000 });
  await page.evaluate(() => {
    window.mockCallObject._videoEnabled = false;
  });

  await openFixAVAndExpandDiagnostics(component);
  await component.locator("text=Others can't see me").click();
  await component.locator('button:has-text("Diagnose & Fix")').click();

  await expect(component.locator("text=Attempting to fix...")).toBeVisible({
    timeout: 5000,
  });
  await expect(component.locator("text=Issue resolved")).toBeVisible({
    timeout: 10000,
  });
  await expect(
    component.locator("text=This dialog will close automatically...")
  ).toBeVisible();
});

/**
 * FIXAV-006: Shows success state when mic track ended and re-acquisition fixes it
 */
test("FIXAV-006: shows success state when mic track ended and re-acquisition fixes it", async ({
  mount,
  page,
}) => {
  test.slow();

  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: twoPlayerConfigWithDevices,
  });
  await page.waitForFunction(() => !!window.mockCallObject, { timeout: 15000 });
  await page.evaluate(() => {
    window.mockCallObject._audioReadyState = "ended";
  });

  await openFixAVAndExpandDiagnostics(component);
  await component.locator("text=Others can't hear me").click();
  await component.locator('button:has-text("Diagnose & Fix")').click();

  await expect(component.locator("text=Attempting to fix...")).toBeVisible({
    timeout: 5000,
  });
  await expect(component.locator("text=Issue resolved")).toBeVisible({
    timeout: 10000,
  });
  await expect(
    component.locator("text=This dialog will close automatically...")
  ).toBeVisible();
});

/**
 * FIXAV-008: Shows success state when camera track ended and re-acquisition fixes it
 */
test("FIXAV-008: shows success state when camera track ended and re-acquisition fixes it", async ({
  mount,
  page,
}) => {
  test.slow();

  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: twoPlayerConfigWithDevices,
  });
  await page.waitForFunction(() => !!window.mockCallObject, { timeout: 15000 });
  await page.evaluate(() => {
    window.mockCallObject._videoReadyState = "ended";
  });

  await openFixAVAndExpandDiagnostics(component);
  await component.locator("text=Others can't see me").click();
  await component.locator('button:has-text("Diagnose & Fix")').click();

  await expect(component.locator("text=Attempting to fix...")).toBeVisible({
    timeout: 5000,
  });
  await expect(component.locator("text=Issue resolved")).toBeVisible({
    timeout: 10000,
  });
  await expect(
    component.locator("text=This dialog will close automatically...")
  ).toBeVisible();
});

/**
 * FIXAV-014: Modal auto-closes after successful fix
 */
test("FIXAV-014: modal auto-closes after successful fix", async ({
  mount,
  page,
}) => {
  test.slow();

  await page.evaluate(() => {
    window.__customAudioContext = true;
    let callCount = 0;
    window.AudioContext = function MockAudioContext() {
      callCount++;
      const state = callCount === 1 ? "suspended" : "running";
      return {
        state,
        addEventListener() {},
        removeEventListener() {},
        resume() {
          return Promise.resolve();
        },
        close() {
          return Promise.resolve();
        },
      };
    };
    window.webkitAudioContext = window.AudioContext;
  });

  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: twoPlayerConfig,
  });

  await openFixAVAndExpandDiagnostics(component);
  await component.locator("text=I can't hear other participants").click();
  await component.locator('button:has-text("Diagnose & Fix")').click();

  await expect(component.locator("text=Issue resolved")).toBeVisible({
    timeout: 10000,
  });
  await expect(component.locator("text=Issue resolved")).not.toBeVisible({
    timeout: 5000,
  });
  // After auto-close, the modal heading should also be gone
  await expect(component.locator("text=Manage Devices")).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// Non-happy-path modal states
// ---------------------------------------------------------------------------

/**
 * FIXAV-015: `failed` state — fixable cause detected but fix throws
 */
test("FIXAV-015: shows failed state when fix throws an error", async ({
  mount,
  page,
}) => {
  test.slow();

  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: twoPlayerConfig,
  });
  await page.waitForFunction(() => !!window.mockCallObject, { timeout: 15000 });

  await page.evaluate(() => {
    window.mockCallObject._audioEnabled = false;
  });
  await page.evaluate(() => {
    window.mockCallObject.setLocalAudio = async () => {
      throw new Error("Device error: cannot unmute");
    };
  });

  await openFixAVAndExpandDiagnostics(component);
  await component.locator("text=Others can't hear me").click();
  await component.locator('button:has-text("Diagnose & Fix")').click();

  await expect(component.locator("text=Attempting to fix...")).toBeVisible({
    timeout: 5000,
  });
  await expect(
    component.locator("text=Could not fix automatically")
  ).toBeVisible({ timeout: 10000 });
  await expect(
    component.locator('button:has-text("Rejoin Call")')
  ).toBeVisible();
  await expect(
    component.locator('button:has-text("Reload Page")')
  ).toBeVisible();
});

/**
 * FIXAV-016: `unfixable` state — only unfixable cause detected
 */
test("FIXAV-016: shows unfixable state when remote participant is muted", async ({
  mount,
  page,
}) => {
  test.slow();

  await page.evaluate(() => {
    window.AudioContext = function MockAudioContext() {
      return {
        state: "running",
        addEventListener() {},
        removeEventListener() {},
        resume() {
          return Promise.resolve();
        },
        close() {
          return Promise.resolve();
        },
      };
    };
    window.webkitAudioContext = window.AudioContext;
  });

  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: twoPlayerConfig,
  });
  await page.waitForFunction(() => !!window.mockCallObject, { timeout: 15000 });

  await page.evaluate(() => {
    window.mockCallObject._participants = {
      "daily-p1": {
        session_id: "daily-p1",
        local: false,
        tracks: {
          audio: {
            subscribed: true,
            state: "off",
            off: { byUser: true },
            blocked: false,
          },
          video: {
            subscribed: true,
            state: "playable",
            off: false,
            blocked: false,
          },
        },
      },
    };
  });

  await openFixAVAndExpandDiagnostics(component);
  await component.locator("text=I can't hear other participants").click();
  await component.locator('button:has-text("Diagnose & Fix")').click();

  await expect(component.locator("text=Attempting to fix...")).toBeVisible({
    timeout: 5000,
  });
  await expect(
    component.locator("text=This issue requires manual action")
  ).toBeVisible({ timeout: 10000 });
  await expect(
    component.locator("text=Ask other participants to unmute")
  ).toBeVisible();
});

/**
 * FIXAV-017: `partial` state — fixable cause resolved + unfixable cause present
 */
test("FIXAV-017: shows partial state when some causes fixed and some unfixable", async ({
  mount,
  page,
}) => {
  test.slow();

  await page.evaluate(() => {
    window.AudioContext = function MockAudioContext() {
      return {
        state: "running",
        addEventListener() {},
        removeEventListener() {},
        resume() {
          return Promise.resolve();
        },
        close() {
          return Promise.resolve();
        },
      };
    };
    window.webkitAudioContext = window.AudioContext;
  });

  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: twoPlayerConfig,
  });
  await page.waitForFunction(() => !!window.mockCallObject, { timeout: 15000 });

  await page.evaluate(() => {
    window.mockCallObject._audioEnabled = false;
  });
  await page.evaluate(() => {
    window.mockCallObject._participants = {
      "daily-p1": {
        session_id: "daily-p1",
        local: false,
        tracks: {
          audio: {
            subscribed: true,
            state: "off",
            off: { byUser: true },
            blocked: false,
          },
          video: {
            subscribed: true,
            state: "playable",
            off: false,
            blocked: false,
          },
        },
      },
    };
  });

  await openFixAVAndExpandDiagnostics(component);
  await component.locator("text=Others can't hear me").click();
  await component.locator("text=I can't hear other participants").click();
  await component.locator('button:has-text("Diagnose & Fix")').click();

  await expect(component.locator("text=Attempting to fix...")).toBeVisible({
    timeout: 5000,
  });
  await expect(component.locator("text=Fixed what we could")).toBeVisible({
    timeout: 10000,
  });
  await expect(
    component.locator('button:has-text("Rejoin Call")')
  ).toBeVisible();
  await expect(
    component.locator('button:has-text("Reload Page")')
  ).toBeVisible();
});

/**
 * FIXAV-018: `unknown` state — no root causes detected
 */
test("FIXAV-018: shows unknown state when no causes detected", async ({
  mount,
  page,
}) => {
  test.slow();

  await page.evaluate(() => {
    window.AudioContext = function MockAudioContext() {
      return {
        state: "running",
        addEventListener() {},
        removeEventListener() {},
        resume() {
          return Promise.resolve();
        },
        close() {
          return Promise.resolve();
        },
      };
    };
    window.webkitAudioContext = window.AudioContext;
  });

  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: twoPlayerConfig,
  });

  await openFixAVAndExpandDiagnostics(component);
  await component.locator("text=Something else").click();
  await component.locator('button:has-text("Diagnose & Fix")').click();

  await expect(component.locator("text=Attempting to fix...")).toBeVisible({
    timeout: 5000,
  });
  await expect(
    component.locator("text=We weren't able to pinpoint the problem")
  ).toBeVisible({ timeout: 10000 });
  await expect(
    component.locator('button:has-text("Rejoin Call")')
  ).toBeVisible();
  await expect(
    component.locator('button:has-text("Reload Page")')
  ).toBeVisible();
});

/**
 * FIXAV-019: `cant-see` issue type — remote camera off shows unfixable state
 */
test("FIXAV-019: cant-see with remote camera off shows unfixable state", async ({
  mount,
  page,
}) => {
  test.slow();

  await page.evaluate(() => {
    window.AudioContext = function MockAudioContext() {
      return {
        state: "running",
        addEventListener() {},
        removeEventListener() {},
        resume() {
          return Promise.resolve();
        },
        close() {
          return Promise.resolve();
        },
      };
    };
    window.webkitAudioContext = window.AudioContext;
  });

  const component = await mount(<Tray {...trayProps} />, {
    hooksConfig: twoPlayerConfig,
  });
  await page.waitForFunction(() => !!window.mockCallObject, { timeout: 15000 });

  await page.evaluate(() => {
    window.mockCallObject._participants = {
      "daily-p1": {
        session_id: "daily-p1",
        local: false,
        tracks: {
          audio: {
            subscribed: true,
            state: "playable",
            off: false,
            blocked: false,
          },
          video: {
            subscribed: true,
            state: "off",
            off: { byUser: true },
            blocked: false,
          },
        },
      },
    };
  });

  await openFixAVAndExpandDiagnostics(component);
  await component.locator("text=I can't see other participants").click();
  await component.locator('button:has-text("Diagnose & Fix")').click();

  await expect(component.locator("text=Attempting to fix...")).toBeVisible({
    timeout: 5000,
  });
  await expect(
    component.locator("text=This issue requires manual action")
  ).toBeVisible({ timeout: 10000 });
  await expect(
    component.locator("text=Ask other participants to turn on their camera")
  ).toBeVisible();
});
