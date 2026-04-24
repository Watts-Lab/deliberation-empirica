/**
 * Mock `detect-browser` for component tests.
 *
 * Replaces: `import { detect } from "detect-browser"`
 *
 * `detect()` returns `{ name, version, os } | null`. Tests override the
 * result via `window.__mockBrowser`. Reading from window at call time
 * (rather than capturing at module load) means tests can change the
 * browser between mounts without reloading modules.
 *
 * Default: a supported desktop Chrome, so components that gate on
 * browser version render their children unless the test opts in to a
 * different browser.
 */
export function detect() {
  if (typeof window !== "undefined" && window.__mockBrowser !== undefined) {
    return window.__mockBrowser;
  }
  return { name: "chrome", version: "120.0.0", os: "mac" };
}
