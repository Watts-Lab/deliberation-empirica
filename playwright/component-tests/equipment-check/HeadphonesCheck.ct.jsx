import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { HeadphonesCheck } from "../../../client/src/intro-exit/setup/HeadphonesCheck";

/**
 * Component Tests for HeadphonesCheck
 *
 * HeadphonesCheck guides the user through:
 *   1. Confirming headphones are on
 *   2. Selecting a speaker/output device
 *   3. Playing a test chime and identifying the sound
 *
 * These tests verify:
 *   HC-001  Step 1 button confirms headphones, reveals Step 2
 *   HC-002  Speaker select populates from Daily devices and advances to Step 3
 *   HC-003  Correct sound identification ("clock") sets status to "pass"
 *   HC-004  Wrong sound identification does not pass
 *   HC-005  "I did not hear anything" shows troubleshooting tips
 *   HC-006  "Choose a different device" resets to speaker selection
 *   HC-007  No speakers triggers fail after timeout
 *   HC-008  setSinkId is called on the audio element when speaker is selected
 *   HC-009  Play button sets status to "started" (for stall timer)
 *   HC-010  Playing indicator appears when audio plays and disappears when ended
 *   HC-011  play() rejection sets status to "fail" with error message
 *   HC-012  Safari: speaker selection is skipped when setSinkId unavailable
 *   HC-013  Safari: no-speakers does not trigger fail (no timeout)
 *   HC-014  Safari: correct sound identification still passes
 *
 * Mock setup:
 *   - MockEmpiricaProvider provides usePlayer()
 *   - MockDailyProvider provides useDevices() with configurable speakers
 *   - HTMLMediaElement.prototype.play is mocked to control playback
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_SPEAKERS = [
  { device: { deviceId: "speaker-1", label: "Built-in Speakers" } },
  { device: { deviceId: "speaker-2", label: "USB Headphones" } },
];

const defaultEmpirica = {
  currentPlayerId: "p0",
  players: [{ id: "p0", attrs: {} }],
};

const defaultDaily = {
  devices: {
    speakers: TEST_SPEAKERS,
    microphones: [],
    cameras: [],
    currentSpeaker: null,
  },
};

function hooksConfig(overrides = {}) {
  return {
    empirica: overrides.empirica || defaultEmpirica,
    daily: { ...defaultDaily, ...overrides.daily },
  };
}

/**
 * Install a mock for HTMLMediaElement.prototype.play that resolves
 * immediately and fires the 'playing' event. Also mocks setSinkId.
 *
 * Access via window._audioPlayCalls and window._setSinkIdCalls.
 */
async function installAudioMocks(page, { playRejects = false } = {}) {
  await page.evaluate(
    (opts) => {
      window._audioPlayCalls = [];
      window._setSinkIdCalls = [];
      window._audioEndedCallbacks = [];

      HTMLMediaElement.prototype.play = function mockPlay() {
        window._audioPlayCalls.push({ src: this.currentSrc || this.src });
        if (opts.playRejects) {
          const err = new DOMException("NotAllowedError", "NotAllowedError");
          return Promise.reject(err);
        }
        // Fire 'playing' event async to match real browser behavior
        const el = this;
        setTimeout(() => el.dispatchEvent(new Event("playing")), 10);
        // Store ref so tests can fire 'ended'
        window._lastAudioElement = el;
        return Promise.resolve();
      };

      HTMLMediaElement.prototype.pause = function mockPause() {
        this.dispatchEvent(new Event("pause"));
      };

      // Mock setSinkId
      HTMLMediaElement.prototype.setSinkId = function mockSetSinkId(id) {
        window._setSinkIdCalls.push({ id });
        return Promise.resolve();
      };
    },
    { playRejects },
  );
}

/** Click the headphones-ready button and select a speaker to reach Step 3. */
async function advanceToStep3(page) {
  // Step 1: confirm headphones
  await page.locator('button:has-text("I have headphones on")').click();

  // Step 2: select a speaker
  await page.locator('[data-testid="speakerSelect"]').selectOption("speaker-1");

  // Wait for Step 3 to render
  await expect(page.locator('[data-testid="playSound"]')).toBeVisible();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/** HC-001: Confirming headphones reveals Step 2 (speaker selection) */
test("HC-001: headphones button reveals speaker selection", async ({
  mount,
  page,
}) => {
  await installAudioMocks(page);

  const statuses = [];
  await mount(
    <HeadphonesCheck
      setHeadphonesStatus={(s) => statuses.push(s)}
      setErrorMessage={() => {}}
    />,
    { hooksConfig: hooksConfig() },
  );

  // Step 2 not visible initially
  await expect(page.locator('[data-testid="speakerSelect"]')).not.toBeVisible();

  // Click "I have headphones on"
  await page.locator('button:has-text("I have headphones on")').click();

  // Step 2 now visible
  await expect(page.locator('[data-testid="speakerSelect"]')).toBeVisible();

  // Button text changed and is disabled
  const btn = page.locator('button:has-text("Headphones ready")');
  await expect(btn).toBeVisible();
  await expect(btn).toBeDisabled();
});

/** HC-002: Selecting a speaker advances to Step 3 (play sound) */
test("HC-002: speaker selection advances to Step 3", async ({
  mount,
  page,
}) => {
  await installAudioMocks(page);

  await mount(
    <HeadphonesCheck
      setHeadphonesStatus={() => {}}
      setErrorMessage={() => {}}
    />,
    { hooksConfig: hooksConfig() },
  );

  // Confirm headphones
  await page.locator('button:has-text("I have headphones on")').click();

  // Select speaker
  await page.locator('[data-testid="speakerSelect"]').selectOption("speaker-2");

  // Step 3 visible with selected device name
  await expect(page.locator('[data-testid="playSound"]')).toBeVisible();
  await expect(page.locator("text=USB Headphones")).toBeVisible();
});

/** HC-003: Correct answer ("clock") sets status to "pass" */
test("HC-003: correct sound identification passes", async ({ mount, page }) => {
  await installAudioMocks(page);

  let latestStatus = "waiting";
  await mount(
    <HeadphonesCheck
      setHeadphonesStatus={(s) => {
        latestStatus = s;
      }}
      setErrorMessage={() => {}}
    />,
    { hooksConfig: hooksConfig() },
  );

  await advanceToStep3(page);

  // Play sound
  await page.locator('[data-testid="playSound"]').click();

  // Wait for radio group to appear
  await expect(page.locator('[data-testid="soundSelect"]')).toBeVisible();

  // Select "A clock chiming the hour"
  await page
    .locator('[data-testid="soundSelect"] input[value="clock"]')
    .check();

  // Status should be "pass" — poll because effect is async
  await expect.poll(() => latestStatus).toBe("pass");
});

/** HC-004: Wrong answer does not set pass */
test("HC-004: wrong sound identification does not pass", async ({
  mount,
  page,
}) => {
  await installAudioMocks(page);

  let latestStatus = "waiting";
  await mount(
    <HeadphonesCheck
      setHeadphonesStatus={(s) => {
        latestStatus = s;
      }}
      setErrorMessage={() => {}}
    />,
    { hooksConfig: hooksConfig() },
  );

  await advanceToStep3(page);
  await page.locator('[data-testid="playSound"]').click();
  await expect(page.locator('[data-testid="soundSelect"]')).toBeVisible();

  // Select wrong answer
  await page.locator('[data-testid="soundSelect"] input[value="dog"]').check();

  // Wait a tick — status should NOT be pass
  await page.waitForTimeout(200);
  expect(latestStatus).not.toBe("pass");
});

/** HC-005: "I did not hear anything" shows troubleshooting */
test("HC-005: no-sound option shows troubleshooting", async ({
  mount,
  page,
}) => {
  await installAudioMocks(page);

  await mount(
    <HeadphonesCheck
      setHeadphonesStatus={() => {}}
      setErrorMessage={() => {}}
    />,
    { hooksConfig: hooksConfig() },
  );

  await advanceToStep3(page);
  await page.locator('[data-testid="playSound"]').click();
  await expect(page.locator('[data-testid="soundSelect"]')).toBeVisible();

  await page.locator('[data-testid="soundSelect"] input[value="none"]').check();

  await expect(
    page.locator("text=Are your headphones connected"),
  ).toBeVisible();
  await expect(page.locator("text=Is the volume turned up")).toBeVisible();
});

/** HC-006: "Choose a different device" resets to speaker selection */
test("HC-006: change speaker resets to selection", async ({ mount, page }) => {
  await installAudioMocks(page);

  await mount(
    <HeadphonesCheck
      setHeadphonesStatus={() => {}}
      setErrorMessage={() => {}}
    />,
    { hooksConfig: hooksConfig() },
  );

  await advanceToStep3(page);

  // Click change device
  await page.locator('button:has-text("Choose a different device")').click();

  // Should be back at speaker selection, Step 3 hidden
  await expect(page.locator('[data-testid="speakerSelect"]')).toBeVisible();
  await expect(page.locator('[data-testid="playSound"]')).not.toBeVisible();
});

/** HC-007: No speakers triggers fail after timeout */
test("HC-007: no speakers triggers fail", async ({ mount, page }) => {
  await installAudioMocks(page);

  let latestStatus = "waiting";
  let latestError = null;
  await mount(
    <HeadphonesCheck
      setHeadphonesStatus={(s) => {
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
    },
  );

  // Should show "No Sound Output Devices Found" or fail after 4s timeout
  await expect.poll(() => latestStatus, { timeout: 6000 }).toBe("fail");
  expect(latestError).toBe("No sound output devices found.");
});

/** HC-008: setSinkId is called when a speaker is selected */
test("HC-008: setSinkId routes audio to selected speaker", async ({
  mount,
  page,
}) => {
  await installAudioMocks(page);

  await mount(
    <HeadphonesCheck
      setHeadphonesStatus={() => {}}
      setErrorMessage={() => {}}
    />,
    { hooksConfig: hooksConfig() },
  );

  await page.locator('button:has-text("I have headphones on")').click();
  await page.locator('[data-testid="speakerSelect"]').selectOption("speaker-2");

  // setSinkId should have been called with the selected speaker ID
  const calls = await page.evaluate(() => window._setSinkIdCalls);
  expect(calls).toEqual([{ id: "speaker-2" }]);
});

/** HC-009: Play button sets status to "started" */
test("HC-009: play sets status to started", async ({ mount, page }) => {
  await installAudioMocks(page);

  const statuses = [];
  await mount(
    <HeadphonesCheck
      setHeadphonesStatus={(s) => statuses.push(s)}
      setErrorMessage={() => {}}
    />,
    { hooksConfig: hooksConfig() },
  );

  await advanceToStep3(page);
  await page.locator('[data-testid="playSound"]').click();

  await expect.poll(() => statuses).toContain("started");
});

/** HC-010: Playing indicator shows during playback and hides on end */
test("HC-010: playing indicator lifecycle", async ({ mount, page }) => {
  await installAudioMocks(page);

  await mount(
    <HeadphonesCheck
      setHeadphonesStatus={() => {}}
      setErrorMessage={() => {}}
    />,
    { hooksConfig: hooksConfig() },
  );

  await advanceToStep3(page);

  // No indicator before play
  await expect(page.locator("text=Playing...")).not.toBeVisible();

  // Click play
  await page.locator('[data-testid="playSound"]').click();

  // Indicator appears (mock fires 'playing' event after 10ms)
  await expect(page.locator("text=Playing...")).toBeVisible();

  // Simulate audio ending
  await page.evaluate(() => {
    window._lastAudioElement?.dispatchEvent(new Event("ended"));
  });

  await expect(page.locator("text=Playing...")).not.toBeVisible();
});

/** HC-011: play() rejection sets fail with error message */
test("HC-011: play rejection sets fail", async ({ mount, page }) => {
  await installAudioMocks(page, { playRejects: true });

  let latestStatus = "waiting";
  let latestError = null;
  await mount(
    <HeadphonesCheck
      setHeadphonesStatus={(s) => {
        latestStatus = s;
      }}
      setErrorMessage={(m) => {
        latestError = m;
      }}
    />,
    { hooksConfig: hooksConfig() },
  );

  await advanceToStep3(page);
  await page.locator('[data-testid="playSound"]').click();

  await expect.poll(() => latestStatus).toBe("fail");
  expect(latestError).toBe("Could not play test sound.");
});

// ---------------------------------------------------------------------------
// Safari / no-setSinkId tests
// ---------------------------------------------------------------------------

/**
 * Remove setSinkId from HTMLMediaElement.prototype BEFORE mounting the
 * component, so canSelectSpeaker evaluates to false.  Also mocks play().
 */
async function installAudioMocksWithoutSinkId(
  page,
  { playRejects = false } = {},
) {
  await page.evaluate(
    (opts) => {
      window._audioPlayCalls = [];
      window._setSinkIdCalls = [];

      // Remove setSinkId so the component detects no speaker selection support
      delete HTMLMediaElement.prototype.setSinkId;

      HTMLMediaElement.prototype.play = function mockPlay() {
        window._audioPlayCalls.push({ src: this.currentSrc || this.src });
        if (opts.playRejects) {
          const err = new DOMException("NotAllowedError", "NotAllowedError");
          return Promise.reject(err);
        }
        const el = this;
        setTimeout(() => el.dispatchEvent(new Event("playing")), 10);
        window._lastAudioElement = el;
        return Promise.resolve();
      };

      HTMLMediaElement.prototype.pause = function mockPause() {
        this.dispatchEvent(new Event("pause"));
      };
    },
    { playRejects },
  );
}

/** HC-012: Speaker selection is skipped when setSinkId is unavailable */
test("HC-012: Safari skips speaker selection", async ({ mount, page }) => {
  await installAudioMocksWithoutSinkId(page);

  await mount(
    <HeadphonesCheck
      setHeadphonesStatus={() => {}}
      setErrorMessage={() => {}}
    />,
    { hooksConfig: hooksConfig() },
  );

  // Step 2 (speaker select) should NOT appear even after confirming headphones
  await page.locator('button:has-text("I have headphones on")').click();
  await expect(page.locator('[data-testid="speakerSelect"]')).not.toBeVisible();

  // Step 2 (sound test) should appear directly — note the step number is "2" not "3"
  await expect(page.locator('[data-testid="playSound"]')).toBeVisible();
  await expect(page.locator("text=system default audio output")).toBeVisible();
});

/** HC-013: No speakers does NOT trigger fail when setSinkId unavailable */
test("HC-013: Safari no-speakers does not fail", async ({ mount, page }) => {
  await installAudioMocksWithoutSinkId(page);

  let latestStatus = "waiting";
  let latestError = null;
  await mount(
    <HeadphonesCheck
      setHeadphonesStatus={(s) => {
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
    },
  );

  // Wait well past the 4s timeout — should NOT fail
  await page.waitForTimeout(5000);
  expect(latestStatus).not.toBe("fail");
  expect(latestError).toBeNull();
});

/** HC-014: Safari flow still passes on correct sound identification */
test("HC-014: Safari correct sound passes", async ({ mount, page }) => {
  await installAudioMocksWithoutSinkId(page);

  let latestStatus = "waiting";
  await mount(
    <HeadphonesCheck
      setHeadphonesStatus={(s) => {
        latestStatus = s;
      }}
      setErrorMessage={() => {}}
    />,
    { hooksConfig: hooksConfig() },
  );

  // Step 1: confirm headphones
  await page.locator('button:has-text("I have headphones on")').click();

  // Step 2 (sound test) appears directly — no speaker selection needed
  await expect(page.locator('[data-testid="playSound"]')).toBeVisible();

  // Play sound
  await page.locator('[data-testid="playSound"]').click();
  await expect(page.locator('[data-testid="soundSelect"]')).toBeVisible();

  // Select correct answer
  await page
    .locator('[data-testid="soundSelect"] input[value="clock"]')
    .check();

  await expect.poll(() => latestStatus).toBe("pass");
});
