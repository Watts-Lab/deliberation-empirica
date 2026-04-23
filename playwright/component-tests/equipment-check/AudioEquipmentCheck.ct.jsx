import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { AudioEquipmentCheck } from "../../../client/src/intro-exit/setup/AudioEquipmentCheck";

/**
 * Component Tests for AudioEquipmentCheck
 *
 * AudioEquipmentCheck orchestrates the audio portion of the intro flow:
 *   permissions → headphones → mic → loopback
 * It renders each check in sequence and calls next() when all pass.
 *
 * These tests verify:
 *   AEC-001  "Begin audio setup" button starts the flow
 *   AEC-002  checkAudio=false skips entirely and calls next()
 *   AEC-003  Cypress bypass sets all checks to pass
 *   AEC-004  Permissions stall timeout shows restart after 30s
 *   AEC-005  Intro screen shows correct checklist
 *
 * Mock setup:
 *   - MockEmpiricaProvider provides usePlayer() and useGlobal()
 *   - MockDailyProvider provides useDevices() and useDaily()
 *   - window.__mockGlobal provides recruitingBatchConfig
 *   - GetPermissions, HeadphonesCheck, MicCheck, LoopbackCheck render as real components
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_SPEAKERS = [
  { device: { deviceId: "speaker-1", label: "Built-in Speakers" } },
];

const TEST_MICS = [
  { device: { deviceId: "mic-1", label: "Built-in Microphone" } },
];

const defaultEmpirica = {
  currentPlayerId: "p0",
  players: [{ id: "p0", attrs: {} }],
};

const defaultDaily = {
  devices: {
    speakers: TEST_SPEAKERS,
    microphones: TEST_MICS,
    cameras: [],
    currentSpeaker: null,
    currentMic: null,
  },
};

function hooksConfig(overrides = {}) {
  return {
    empirica: overrides.empirica || defaultEmpirica,
    daily: { ...defaultDaily, ...overrides.daily },
  };
}

async function setupGlobalsMock(page, { checkAudio = true } = {}) {
  await page.evaluate(
    (opts) => {
      window.__mockGlobal = {
        get(key) {
          if (key === "recruitingBatchConfig") {
            return { checkAudio: opts.checkAudio, checkVideo: true };
          }
          return null;
        },
      };
    },
    { checkAudio }
  );
}

async function installAudioMocks(page) {
  await page.evaluate(() => {
    window._audioPlayCalls = [];
    window._setSinkIdCalls = [];

    HTMLMediaElement.prototype.play = function mockPlay() {
      window._audioPlayCalls.push({ src: this.currentSrc || this.src });
      const el = this;
      setTimeout(() => el.dispatchEvent(new Event("playing")), 10);
      window._lastAudioElement = el;
      return Promise.resolve();
    };

    HTMLMediaElement.prototype.pause = function mockPause() {
      this.dispatchEvent(new Event("pause"));
    };

    HTMLMediaElement.prototype.setSinkId = function mockSetSinkId(id) {
      window._setSinkIdCalls.push({ id });
      return Promise.resolve();
    };
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/** AEC-001: "Begin audio setup" button starts the flow */
test("AEC-001: begin button starts flow", async ({ mount, page }) => {
  await setupGlobalsMock(page);
  await installAudioMocks(page);

  await mount(<AudioEquipmentCheck next={() => {}} />, {
    hooksConfig: hooksConfig(),
  });

  // Should show the intro screen
  await expect(page.locator("text=Set up your sound")).toBeVisible();
  await expect(page.locator('[data-testid="startAudioSetup"]')).toBeVisible();

  // Click begin
  await page.locator('[data-testid="startAudioSetup"]').click();

  // Flow should have started — permissions or headphones check visible
  // (GetPermissions will render since we don't have real permissions)
  await expect(page.locator("text=Set up your sound")).not.toBeVisible();
});

/** AEC-002: checkAudio=false (with checkVideo=false) skips and calls next() */
test("AEC-002: checkAudio false skips", async ({ mount, page }) => {
  // checkAudio is forced true when checkVideo is true (line 30 of AudioEquipmentCheck),
  // so both must be false to skip.
  await page.evaluate(() => {
    window.__mockGlobal = {
      get(key) {
        if (key === "recruitingBatchConfig") {
          return { checkAudio: false, checkVideo: false };
        }
        return null;
      },
    };
  });

  let nextCalled = false;
  await mount(
    <AudioEquipmentCheck
      next={() => {
        nextCalled = true;
      }}
    />,
    { hooksConfig: hooksConfig() }
  );

  await expect.poll(() => nextCalled).toBe(true);
});

/** AEC-003: Cypress bypass sets all to pass and calls next */
test("AEC-003: Cypress bypass", async ({ mount, page }) => {
  await setupGlobalsMock(page);
  await installAudioMocks(page);

  // Set Cypress flag before mount
  await page.evaluate(() => {
    window.Cypress = true;
  });

  let nextCalled = false;
  await mount(
    <AudioEquipmentCheck
      next={() => {
        nextCalled = true;
      }}
    />,
    { hooksConfig: hooksConfig() }
  );

  // Start the flow
  await page.locator('[data-testid="startAudioSetup"]').click();

  // Cypress flag should auto-pass everything
  await expect.poll(() => nextCalled, { timeout: 5000 }).toBe(true);
});

/** AEC-004: Permissions stall timeout shows restart button after 30s */
test("AEC-004: permissions stall timeout shows restart", async ({
  mount,
  page,
}) => {
  // Install fake clock BEFORE mount so setTimeout is patched
  await page.clock.install();

  await setupGlobalsMock(page);
  await installAudioMocks(page);

  await mount(<AudioEquipmentCheck next={() => {}} />, {
    hooksConfig: hooksConfig(),
  });

  // Start the flow — GetPermissions renders but can't resolve (no real permissions)
  await page.locator('[data-testid="startAudioSetup"]').click();

  // Before 30s: no restart button
  await page.clock.fastForward(29000);
  await expect(page.locator("text=Restart audio checks")).not.toBeVisible();

  // After 30s: restart button appears
  await page.clock.fastForward(2000);
  await expect(page.locator("text=Restart audio checks")).toBeVisible();
  await expect(page.locator("text=Taking longer than expected")).toBeVisible();
});

/** AEC-005: Flow renders the begin screen with correct checklist */
test("AEC-005: intro screen shows checklist", async ({ mount, page }) => {
  await setupGlobalsMock(page);
  await installAudioMocks(page);

  await mount(<AudioEquipmentCheck next={() => {}} />, {
    hooksConfig: hooksConfig(),
  });

  await expect(page.locator("text=Put on headphones or earbuds")).toBeVisible();
  await expect(
    page.locator("text=Test that your headphones are working")
  ).toBeVisible();
  await expect(page.locator("text=Choose the mic")).toBeVisible();
  await expect(page.locator("text=Check for audio feedback")).toBeVisible();
});
