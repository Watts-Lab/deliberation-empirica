/**
 * Console capture utility for Playwright component tests
 *
 * Sets up a page.on('console', ...) listener BEFORE mount to intercept all
 * console output from the component under test.
 *
 * ## Usage
 *
 *   import { setupConsoleCapture } from '../../mocks/console-capture.js';
 *
 *   test('example', async ({ mount, page }) => {
 *     const console = setupConsoleCapture(page);
 *
 *     const component = await mount(<MyComponent />, { hooksConfig: config });
 *
 *     // Assert on captured console output
 *     expect(console.matching(/Setting camera via/)).toHaveLength(1);
 *     expect(console.getLogs()).not.toContain(expect.objectContaining({ text: /not available/ }));
 *   });
 *
 * ## IMPORTANT: Set up BEFORE mount
 *
 * The listener must be attached before mount() is called, because console
 * messages emitted during component initialization will be missed otherwise.
 * Playwright's page.on() is synchronous and captures all subsequent messages.
 *
 * ## Filtering
 *
 * Messages from Vite/Playwright infrastructure (hot reload, etc.) are filtered
 * out automatically. Only messages from component code are included.
 */

/** Internal prefixes from Vite/Playwright infrastructure to exclude */
const INFRA_PREFIXES = [
  '[vite]',
  '[HMR]',
  '[Playwright CT]',
  '[Playground CT]',
];

function isInfraMessage(text) {
  return INFRA_PREFIXES.some(prefix => text.startsWith(prefix));
}

/**
 * Set up console capture on a Playwright page.
 *
 * Call this BEFORE mount(). Returns a capture object to inspect messages.
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} options
 * @param {boolean} [options.includeInfra=false] - Include Vite/Playwright infra messages
 * @returns {ConsoleCaptureHandle}
 */
export function setupConsoleCapture(page, { includeInfra = false } = {}) {
  const messages = [];

  const handler = (msg) => {
    const text = msg.text();
    if (!includeInfra && isInfraMessage(text)) return;
    messages.push({
      type: msg.type(),   // 'log', 'warning', 'error', 'info', etc.
      text,
    });
  };

  page.on('console', handler);

  return {
    /** All captured messages */
    getAll() { return [...messages]; },

    /** Only console.log messages */
    getLogs() { return messages.filter(m => m.type === 'log'); },

    /** Only console.warn messages */
    getWarnings() { return messages.filter(m => m.type === 'warning'); },

    /** Only console.error messages */
    getErrors() { return messages.filter(m => m.type === 'error'); },

    /**
     * Messages whose text matches a string or regex pattern
     * @param {string|RegExp} pattern
     */
    matching(pattern) {
      const test = typeof pattern === 'string'
        ? (text) => text.includes(pattern)
        : (text) => pattern.test(text);
      return messages.filter(m => test(m.text));
    },

    /** Clear all captured messages */
    clear() { messages.length = 0; },

    /** Stop listening (useful for cleanup) */
    stop() { page.off('console', handler); },
  };
}
