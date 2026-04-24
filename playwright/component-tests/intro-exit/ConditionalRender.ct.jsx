import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { BrowserConditionalRender } from "../../../client/src/components/ConditionalRender";

/**
 * Component Tests for BrowserConditionalRender
 *
 * Replaces cypress/e2e/05_Mobile_Check.js and extends it to cover the
 * browser-version gate in the same component. See issue #21.
 *
 * BrowserConditionalRender blocks the study on:
 *   - Mobile devices (any) — "ERROR: Mobile Device Detected"
 *   - Browsers below minimum version — "ERROR: Browser Version Detected"
 *       chrome/firefox/edge: < 89
 *       opera: < 75
 *       safari: < 15
 *
 * Supported browsers render the children untouched.
 *
 * Tests:
 *   BCR-001  Mobile device blocks, shows mobile error
 *   BCR-002  Unsupported chrome (< 89) blocks, shows browser error
 *   BCR-003  Unsupported safari (< 15) blocks, shows browser error
 *   BCR-004  Unsupported opera (< 75) blocks, shows browser error
 *   BCR-005  Supported chrome renders children
 *   BCR-006  Supported safari renders children (threshold = 15)
 *   BCR-007  Supported opera renders children (threshold = 75)
 *   BCR-008  Supported firefox renders children
 *   BCR-009  Mobile takes precedence over unsupported-browser check
 *
 * Mock setup:
 *   - react-device-detect mock exposes `isMobile` as an ESM live binding.
 *     Tests set `window.__mockIsMobile` before mount; if the module is
 *     already loaded, call `window.__refreshMockBrowserCompat()` to
 *     update the exported binding.
 *   - detect-browser mock's `detect()` reads `window.__mockBrowser`.
 */

const TEST_CHILD = "STUDY_CONTENT_RENDERED";

async function setMockEnv(page, { isMobile = false, browser } = {}) {
  await page.evaluate(
    (env) => {
      window.__mockIsMobile = env.isMobile;
      window.__mockBrowser = env.browser || {
        name: "chrome",
        version: "120.0.0",
        os: "mac",
      };
      // If the react-device-detect mock has already been imported in
      // this page, refresh its exported `isMobile` binding.
      if (typeof window.__refreshMockBrowserCompat === "function") {
        window.__refreshMockBrowserCompat();
      }
    },
    { isMobile, browser },
  );
}

test.describe("BrowserConditionalRender", () => {
  test("BCR-001: mobile device blocks with mobile error", async ({
    mount,
    page,
  }) => {
    await setMockEnv(page, { isMobile: true });

    const component = await mount(
      <BrowserConditionalRender>
        <div>STUDY_CONTENT_RENDERED</div>
      </BrowserConditionalRender>,
    );

    await expect(
      component.getByText("ERROR: Mobile Device Detected"),
    ).toBeVisible();
    await expect(component.getByText(TEST_CHILD)).not.toBeVisible();
  });

  test("BCR-002: unsupported chrome (v50) blocks with browser error", async ({
    mount,
    page,
  }) => {
    await setMockEnv(page, {
      browser: { name: "chrome", version: "50.0.0", os: "mac" },
    });

    const component = await mount(
      <BrowserConditionalRender>
        <div>STUDY_CONTENT_RENDERED</div>
      </BrowserConditionalRender>,
    );

    await expect(
      component.getByText("ERROR: Browser Version Detected"),
    ).toBeVisible();
    await expect(component.getByText("Chrome >= 89")).toBeVisible();
    await expect(component.getByText(TEST_CHILD)).not.toBeVisible();
  });

  test("BCR-003: unsupported safari (v14) blocks with browser error", async ({
    mount,
    page,
  }) => {
    await setMockEnv(page, {
      browser: { name: "safari", version: "14.1.0", os: "mac" },
    });

    const component = await mount(
      <BrowserConditionalRender>
        <div>STUDY_CONTENT_RENDERED</div>
      </BrowserConditionalRender>,
    );

    await expect(
      component.getByText("ERROR: Browser Version Detected"),
    ).toBeVisible();
    await expect(component.getByText(TEST_CHILD)).not.toBeVisible();
  });

  test("BCR-004: unsupported opera (v74) blocks with browser error", async ({
    mount,
    page,
  }) => {
    await setMockEnv(page, {
      browser: { name: "opera", version: "74.0.0", os: "mac" },
    });

    const component = await mount(
      <BrowserConditionalRender>
        <div>STUDY_CONTENT_RENDERED</div>
      </BrowserConditionalRender>,
    );

    await expect(
      component.getByText("ERROR: Browser Version Detected"),
    ).toBeVisible();
    await expect(component.getByText(TEST_CHILD)).not.toBeVisible();
  });

  test("BCR-005: supported chrome renders children", async ({
    mount,
    page,
  }) => {
    await setMockEnv(page, {
      browser: { name: "chrome", version: "120.0.0", os: "mac" },
    });

    const component = await mount(
      <BrowserConditionalRender>
        <div>STUDY_CONTENT_RENDERED</div>
      </BrowserConditionalRender>,
    );

    await expect(component.getByText(TEST_CHILD)).toBeVisible();
    await expect(
      component.getByText("ERROR: Browser Version Detected"),
    ).not.toBeVisible();
    await expect(
      component.getByText("ERROR: Mobile Device Detected"),
    ).not.toBeVisible();
  });

  test("BCR-006: safari at threshold (v15) renders children", async ({
    mount,
    page,
  }) => {
    await setMockEnv(page, {
      browser: { name: "safari", version: "15.0.0", os: "mac" },
    });

    const component = await mount(
      <BrowserConditionalRender>
        <div>STUDY_CONTENT_RENDERED</div>
      </BrowserConditionalRender>,
    );

    await expect(component.getByText(TEST_CHILD)).toBeVisible();
  });

  test("BCR-007: opera at threshold (v75) renders children", async ({
    mount,
    page,
  }) => {
    await setMockEnv(page, {
      browser: { name: "opera", version: "75.0.0", os: "mac" },
    });

    const component = await mount(
      <BrowserConditionalRender>
        <div>STUDY_CONTENT_RENDERED</div>
      </BrowserConditionalRender>,
    );

    await expect(component.getByText(TEST_CHILD)).toBeVisible();
  });

  test("BCR-008: supported firefox renders children", async ({
    mount,
    page,
  }) => {
    await setMockEnv(page, {
      browser: { name: "firefox", version: "120.0.0", os: "mac" },
    });

    const component = await mount(
      <BrowserConditionalRender>
        <div>STUDY_CONTENT_RENDERED</div>
      </BrowserConditionalRender>,
    );

    await expect(component.getByText(TEST_CHILD)).toBeVisible();
  });

  test("BCR-009: mobile takes precedence over unsupported-browser check", async ({
    mount,
    page,
  }) => {
    // Mobile + old browser: should show the MOBILE error, not the browser one.
    await setMockEnv(page, {
      isMobile: true,
      browser: { name: "chrome", version: "50.0.0", os: "android" },
    });

    const component = await mount(
      <BrowserConditionalRender>
        <div>STUDY_CONTENT_RENDERED</div>
      </BrowserConditionalRender>,
    );

    await expect(
      component.getByText("ERROR: Mobile Device Detected"),
    ).toBeVisible();
    await expect(
      component.getByText("ERROR: Browser Version Detected"),
    ).not.toBeVisible();
  });
});
