/**
 * Mock for @empirica/core/player/react
 *
 * Provides useGlobal that reads from window.__mockGlobal, allowing tests
 * to configure global Empirica state without a real backend.
 *
 * Usage in tests:
 *   await page.evaluate(() => {
 *     window.__mockGlobal = {
 *       get(key) {
 *         if (key === 'cdnList') return { prod: 'http://test-cdn.example.com' };
 *         if (key === 'recruitingBatchConfig') return { cdn: 'prod' };
 *         return null;
 *       },
 *     };
 *   });
 */
export function useGlobal() {
  if (typeof window !== 'undefined' && window.__mockGlobal) {
    return window.__mockGlobal;
  }
  return null;
}
