import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { Debrief } from '../../../client/src/intro-exit/Debrief';

/**
 * Component Tests for Debrief
 *
 * The Debrief page is the final screen shown after all exit steps.
 * It displays:
 *   - "Finished!" heading
 *   - Exit/completion code (if exitCodes !== "none") with copy button
 *   - Custom debrief markdown (fetched from CDN) or generic message
 *   - "You may now close this window."
 *
 * Tests:
 *   DEBRIEF-001  Custom debrief markdown renders from CDN
 *   DEBRIEF-002  Generic message when debrief is "none"
 *   DEBRIEF-003  Exit code displayed when provided
 *   DEBRIEF-004  Exit code section hidden when exitCodes is "none"
 *   DEBRIEF-005  Copy to clipboard button works
 *   DEBRIEF-006  Loading state when player is null
 *   DEBRIEF-007  Loading state while custom debrief is being fetched
 *   DEBRIEF-008  setAllowIdle called on mount
 *   DEBRIEF-009  "You may now close this window" always visible
 *
 * Mock setup:
 *   - MockEmpiricaProvider provides usePlayer()
 *   - window.__mockGlobal provides useGlobal() (recruitingBatchConfig, cdnList)
 *   - page.route() intercepts CDN fetches to serve test markdown
 *   - IdleProvider default context is sufficient (setAllowIdle is a no-op)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EXIT_CODES = {
  complete: 'TEST_COMPLETE_CODE',
  error: 'TEST_ERROR_CODE',
  lobbyTimeout: 'TEST_LOBBY_CODE',
  failedEquipmentCheck: 'TEST_EQUIP_CODE',
};

function empiricaConfig(exitCodes = EXIT_CODES) {
  return {
    empirica: {
      currentPlayerId: 'p0',
      players: [{ id: 'p0', attrs: { exitCodes } }],
    },
  };
}

async function setupGlobals(page, { debrief = 'none' } = {}) {
  await page.evaluate((opts) => {
    window.__mockGlobal = {
      get(key) {
        if (key === 'recruitingBatchConfig') {
          // Server pre-resolves `cdnURL` before publishing batchConfig.
          // The client reads batchConfig.cdnURL directly; no cdnList global.
          return {
            cdnURL: 'http://localhost:9091',
            debrief: opts.debrief,
          };
        }
        return null;
      },
    };
  }, { debrief });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Debrief Page', () => {

  test('DEBRIEF-001: custom debrief markdown renders from CDN', async ({ mount, page }) => {
    const customMarkdown = '### About our study\n\nThis was a test of group deliberation.';

    // Intercept CDN fetch to serve test markdown
    await page.route('**/projects/example/debrief.md', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/markdown',
        body: customMarkdown,
      });
    });

    await setupGlobals(page, { debrief: 'projects/example/debrief.md' });

    const component = await mount(<Debrief />, { hooksConfig: empiricaConfig() });

    await expect(component.getByText('About our study')).toBeVisible();
    await expect(component.getByText('This was a test of group deliberation.')).toBeVisible();
    // Generic message should not appear when custom content is loaded
    await expect(component.getByText('Thank you for participating.', { exact: true })).not.toBeVisible();
  });

  test('DEBRIEF-002: generic message when debrief is "none"', async ({ mount, page }) => {
    await setupGlobals(page, { debrief: 'none' });

    const component = await mount(<Debrief />, { hooksConfig: empiricaConfig() });

    await expect(component.getByText('Thank you for participating.')).toBeVisible();
  });

  test('DEBRIEF-003: exit code displayed when provided', async ({ mount, page }) => {
    await setupGlobals(page);

    const component = await mount(<Debrief />, { hooksConfig: empiricaConfig() });

    await expect(component.getByText('TEST_COMPLETE_CODE')).toBeVisible();
    await expect(component.getByText(/completion code/i)).toBeVisible();
    await expect(component.getByText('Copy to clipboard')).toBeVisible();
  });

  test('DEBRIEF-004: exit code section hidden when exitCodes is "none"', async ({ mount, page }) => {
    await setupGlobals(page);

    const component = await mount(<Debrief />, { hooksConfig: empiricaConfig('none') });

    await expect(component.getByText(/completion code/i)).not.toBeVisible();
    await expect(component.getByText('Copy to clipboard')).not.toBeVisible();
  });

  test('DEBRIEF-005: copy to clipboard button triggers alert with code', async ({ mount, page }) => {
    await setupGlobals(page);

    const component = await mount(<Debrief />, { hooksConfig: empiricaConfig() });

    // Auto-accept dialogs and capture the message
    let dialogMessage = null;
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Ensure clipboard API exists in the component frame (it may not in CT iframe)
    await page.evaluate(() => {
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        navigator.clipboard = {
          writeText: () => Promise.resolve(),
        };
      }
    });

    await component.getByText('Copy to clipboard').click();

    // Wait for dialog handler to capture the message
    await expect.poll(() => dialogMessage, { timeout: 5000 }).not.toBeNull();
    expect(dialogMessage).toContain('TEST_COMPLETE_CODE');
    expect(dialogMessage).toContain('clipboard');
  });

  test('DEBRIEF-006: loading state when player is null', async ({ mount, page }) => {
    await setupGlobals(page);

    // Mount without empirica config so usePlayer() returns null
    const component = await mount(<Debrief />);

    // stagebook's Loading renders an SVG with aria-label="Loading"
    await expect(component.getByLabel('Loading')).toBeVisible();
  });

  test('DEBRIEF-007: inline loading while custom debrief is being fetched', async ({ mount, page }) => {
    // Intercept CDN fetch but delay the response
    let fulfillRoute;
    const routePromise = new Promise((resolve) => { fulfillRoute = resolve; });

    await page.route('**/projects/example/slow-debrief.md', (route) => {
      // Store route to fulfill later
      fulfillRoute(route);
    });

    await setupGlobals(page, { debrief: 'projects/example/slow-debrief.md' });

    const component = await mount(<Debrief />, { hooksConfig: empiricaConfig() });

    // Exit code and page chrome should be visible while debrief is loading
    await expect(component.getByText('TEST_COMPLETE_CODE')).toBeVisible();
    // stagebook's Loading renders an SVG with aria-label="Loading"
    await expect(component.getByLabel('Loading')).toBeVisible();

    // Now fulfill the route
    const route = await routePromise;
    await route.fulfill({
      status: 200,
      contentType: 'text/markdown',
      body: 'Delayed debrief content',
    });

    // Custom content should replace inline loading
    await expect(component.getByText('Delayed debrief content')).toBeVisible();
    await expect(component.getByLabel('Loading')).not.toBeVisible();
  });

  test('DEBRIEF-008: setAllowIdle called on mount', async ({ mount, page }) => {
    await setupGlobals(page);

    // Track useAllowIdle via the console.log it emits — attach BEFORE mount
    const consolePromise = page.waitForEvent('console', {
      predicate: (msg) => msg.text().includes('Allow idle: true'),
      timeout: 5000,
    });

    await mount(<Debrief />, { hooksConfig: empiricaConfig() });

    const msg = await consolePromise;
    expect(msg.text()).toContain('Allow idle: true');
  });

  test('DEBRIEF-009a: "You may now close this window" visible with exit codes', async ({ mount, page }) => {
    await setupGlobals(page);
    const component = await mount(<Debrief />, { hooksConfig: empiricaConfig() });
    await expect(component.getByText('You may now close this window.')).toBeVisible();
  });

  test('DEBRIEF-009b: "You may now close this window" visible without exit codes', async ({ mount, page }) => {
    await setupGlobals(page);
    const component = await mount(<Debrief />, { hooksConfig: empiricaConfig('none') });
    await expect(component.getByText('You may now close this window.')).toBeVisible();
  });

});
