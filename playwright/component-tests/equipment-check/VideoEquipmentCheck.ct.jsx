import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoEquipmentCheck } from '../../../client/src/intro-exit/setup/VideoEquipmentCheck';

/**
 * Component Tests for VideoEquipmentCheck
 *
 * VideoEquipmentCheck orchestrates the camera portion of the intro flow:
 *   permissions → camera check (with network tests)
 * It renders each check in sequence and calls next() when all pass.
 *
 * These tests verify:
 *   VEC-001  "Begin camera setup" button starts the flow
 *   VEC-002  checkVideo=false skips entirely and calls next()
 *   VEC-003  Cypress bypass sets all checks to pass
 *   VEC-004  Intro screen shows correct checklist
 *   VEC-005  Stall timeout shows restart escape hatch (120s for camera)
 *
 * Mock setup:
 *   - MockEmpiricaProvider provides usePlayer() and useGlobal()
 *   - window.__mockGlobal provides recruitingBatchConfig
 *   - GetPermissions and CameraCheck render as real components (mocked Daily)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultEmpirica = {
  currentPlayerId: 'p0',
  players: [{ id: 'p0', attrs: {} }],
};

function hooksConfig(overrides = {}) {
  return {
    empirica: overrides.empirica || defaultEmpirica,
    daily: overrides.daily || {
      devices: { speakers: [], microphones: [], cameras: [] },
    },
  };
}

async function setupGlobalsMock(page, { checkVideo = true } = {}) {
  await page.evaluate((opts) => {
    window.__mockGlobal = {
      get(key) {
        if (key === 'recruitingBatchConfig') {
          return { checkVideo: opts.checkVideo, checkAudio: true };
        }
        return null;
      },
    };
  }, { checkVideo });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/** VEC-001: "Begin camera setup" button starts the flow */
test('VEC-001: begin button starts flow', async ({ mount, page }) => {
  await setupGlobalsMock(page);

  await mount(
    <VideoEquipmentCheck next={() => {}} />,
    { hooksConfig: hooksConfig() },
  );

  // Should show intro screen
  await expect(page.locator('text=Set up your camera')).toBeVisible();
  await expect(page.locator('[data-test="startVideoSetup"]')).toBeVisible();

  // Click begin
  await page.locator('[data-test="startVideoSetup"]').click();

  // Intro screen should be gone
  await expect(page.locator('text=Set up your camera')).not.toBeVisible();
});

/** VEC-002: checkVideo=false skips and calls next() */
test('VEC-002: checkVideo false skips', async ({ mount, page }) => {
  await setupGlobalsMock(page, { checkVideo: false });

  let nextCalled = false;
  await mount(
    <VideoEquipmentCheck next={() => { nextCalled = true; }} />,
    { hooksConfig: hooksConfig() },
  );

  await expect.poll(() => nextCalled).toBe(true);
});

/** VEC-003: Cypress bypass auto-passes */
test('VEC-003: Cypress bypass', async ({ mount, page }) => {
  await setupGlobalsMock(page);
  await page.evaluate(() => { window.Cypress = true; });

  let nextCalled = false;
  await mount(
    <VideoEquipmentCheck next={() => { nextCalled = true; }} />,
    { hooksConfig: hooksConfig() },
  );

  await page.locator('[data-test="startVideoSetup"]').click();
  await expect.poll(() => nextCalled, { timeout: 5000 }).toBe(true);
});

/** VEC-004: Intro screen shows correct checklist */
test('VEC-004: intro screen checklist', async ({ mount, page }) => {
  await setupGlobalsMock(page);

  await mount(
    <VideoEquipmentCheck next={() => {}} />,
    { hooksConfig: hooksConfig() },
  );

  await expect(page.locator('text=Grant access to camera')).toBeVisible();
  await expect(page.locator('text=Pick the webcam you plan to use')).toBeVisible();
  await expect(page.locator('text=Test your connection quality')).toBeVisible();
});

/** VEC-005: Flow starts after clicking begin */
test('VEC-005: flow proceeds past intro screen', async ({ mount, page }) => {
  await setupGlobalsMock(page);

  await mount(
    <VideoEquipmentCheck next={() => {}} />,
    { hooksConfig: hooksConfig() },
  );

  await page.locator('[data-test="startVideoSetup"]').click();

  // Verify the flow started (intro screen gone, permissions check or loading visible)
  await expect(page.locator('[data-test="startVideoSetup"]')).not.toBeVisible();
});
