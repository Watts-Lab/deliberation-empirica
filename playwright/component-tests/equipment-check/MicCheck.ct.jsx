import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { MicCheck } from "../../../client/src/intro-exit/setup/MicCheck";

/**
 * Component Tests for MicCheck
 *
 * MicCheck guides the user through:
 *   1. Selecting a microphone from Daily's device list
 *   2. Speaking into the mic while watching an audio level indicator
 *   3. Passing when audio level exceeds the threshold
 *
 * These tests verify:
 *   MC-001  Microphone select populates from Daily devices
 *   MC-002  Selecting a mic shows the audio level indicator
 *   MC-003  "Try a different mic" resets to selection
 *   MC-004  No microphones triggers fail after timeout
 *   MC-005  Status is set to "started" when testing begins
 *   MC-006  Player data is logged when mic is selected
 *
 * Mock setup:
 *   - MockEmpiricaProvider provides usePlayer()
 *   - MockDailyProvider provides useDevices() with configurable microphones
 *   - useAudioLevelObserver is a no-op (audio level indicator stays at 0)
 *   - useDaily() returns mock call object
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_MICS = [
  { device: { deviceId: "mic-1", label: "Built-in Microphone" } },
  { device: { deviceId: "mic-2", label: "USB Headset Mic" } },
];

const defaultEmpirica = {
  currentPlayerId: "p0",
  players: [{ id: "p0", attrs: {} }],
};

const defaultDaily = {
  devices: {
    speakers: [],
    microphones: TEST_MICS,
    cameras: [],
    currentMic: null,
  },
};

function hooksConfig(overrides = {}) {
  return {
    empirica: overrides.empirica || defaultEmpirica,
    daily: { ...defaultDaily, ...overrides.daily },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/** MC-001: Microphone select populates from Daily devices */
test("MC-001: mic select shows available microphones", async ({
  mount,
  page,
}) => {
  await mount(<MicCheck setMicStatus={() => {}} setErrorMessage={() => {}} />, {
    hooksConfig: hooksConfig(),
  });

  await expect(page.locator('[data-testid="microphoneSelect"]')).toBeVisible();

  // Both mics should appear as options
  const options = page.locator(
    '[data-testid="microphoneSelect"] option:not([hidden])'
  );
  await expect(options).toHaveCount(2);
  await expect(options.nth(0)).toHaveText("Built-in Microphone");
  await expect(options.nth(1)).toHaveText("USB Headset Mic");
});

/** MC-002: Selecting a mic shows the audio level indicator */
test("MC-002: selecting mic shows audio level indicator", async ({
  mount,
  page,
}) => {
  await mount(<MicCheck setMicStatus={() => {}} setErrorMessage={() => {}} />, {
    hooksConfig: hooksConfig(),
  });

  // Select a microphone
  await page.locator('[data-testid="microphoneSelect"]').selectOption("mic-1");

  // Audio level section should appear (the bar itself may have 0 width)
  await expect(page.locator("text=Audio level:")).toBeVisible();

  // Should show the selected mic name
  await expect(page.locator("text=Built-in Microphone")).toBeVisible();
});

/** MC-003: "Try a different mic" resets to selection */
test("MC-003: change mic resets to selection", async ({ mount, page }) => {
  await mount(<MicCheck setMicStatus={() => {}} setErrorMessage={() => {}} />, {
    hooksConfig: hooksConfig(),
  });

  // Select a mic
  await page.locator('[data-testid="microphoneSelect"]').selectOption("mic-1");
  await expect(page.locator("text=Audio level:")).toBeVisible();

  // Click "Try a different mic"
  await page.locator('button:has-text("Try a different mic")').click();

  // Should be back at mic selection
  await expect(page.locator('[data-testid="microphoneSelect"]')).toBeVisible();
  await expect(page.locator("text=Audio level:")).not.toBeVisible();
});

/** MC-004: No microphones triggers fail after timeout */
test("MC-004: no microphones triggers fail", async ({ mount }) => {
  let latestStatus = "waiting";
  let latestError = null;

  await mount(
    <MicCheck
      setMicStatus={(s) => {
        latestStatus = s;
      }}
      setErrorMessage={(m) => {
        latestError = m;
      }}
    />,
    {
      hooksConfig: hooksConfig({
        daily: { devices: { speakers: [], microphones: [], cameras: [] } },
      }),
    }
  );

  await expect.poll(() => latestStatus, { timeout: 6000 }).toBe("fail");
  expect(latestError).toBe("No microphones found.");
});

/** MC-005: Status set to "started" when testing begins */
test("MC-005: status set to started on test begin", async ({ mount, page }) => {
  const statuses = [];

  await mount(
    <MicCheck
      setMicStatus={(s) => statuses.push(s)}
      setErrorMessage={() => {}}
    />,
    { hooksConfig: hooksConfig() }
  );

  // Select a mic to begin testing
  await page.locator('[data-testid="microphoneSelect"]').selectOption("mic-1");

  // Should have set "started" when AudioLevelIndicator mounted
  await expect.poll(() => statuses).toContain("started");
});

/** MC-006: Player data is stored when mic is selected */
test("MC-006: mic selection stores player data", async ({ mount, page }) => {
  await mount(<MicCheck setMicStatus={() => {}} setErrorMessage={() => {}} />, {
    hooksConfig: hooksConfig(),
  });

  await page.locator('[data-testid="microphoneSelect"]').selectOption("mic-2");

  // MockEmpiricaProvider exposes players on window.mockPlayers
  const micId = await page.evaluate(() =>
    window.mockPlayers?.[0]?.get("micId")
  );
  expect(micId).toBe("mic-2");

  const micLabel = await page.evaluate(() =>
    window.mockPlayers?.[0]?.get("micLabel")
  );
  expect(micLabel).toBe("USB Headset Mic");
});
