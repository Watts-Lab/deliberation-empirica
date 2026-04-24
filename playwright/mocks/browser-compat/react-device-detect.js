/**
 * Mock `react-device-detect` for component tests.
 *
 * Replaces: `import { isMobile } from "react-device-detect"`
 *
 * ## Usage
 *
 * Default: `isMobile = false` (desktop). Tests flip to mobile via:
 *
 *   await page.evaluate(() => { window.__mockIsMobile = true; });
 *   // If the module is already loaded from a previous mount, refresh
 *   // the exported binding so subsequent reads reflect the new value:
 *   await page.evaluate(() => window.__refreshMockBrowserCompat?.());
 *
 * ## Why this pattern
 *
 * `isMobile` is imported as a value binding, not a function call, so
 * consumers read it directly at render time. We use ESM live bindings
 * (`export let`) so we can update the value from the same module. A
 * helper exposed on `window` lets tests refresh the binding after module
 * load; the initial value is read from `window.__mockIsMobile` at module
 * load time so tests that set the window flag before first mount still
 * pick it up.
 */

function computeIsMobile() {
  return typeof window !== "undefined" && window.__mockIsMobile === true;
}

export let isMobile = computeIsMobile();

// Stubs for other named exports consumers may pull in — harmless defaults.
export const isBrowser = true;
export const isDesktop = true;
export const isTablet = false;
export const browserName = "Chrome";
export const browserVersion = "120.0.0";
export const osName = "Mac OS";
export const deviceType = "desktop";

if (typeof window !== "undefined") {
  window.__refreshMockBrowserCompat = () => {
    isMobile = computeIsMobile();
  };
}
