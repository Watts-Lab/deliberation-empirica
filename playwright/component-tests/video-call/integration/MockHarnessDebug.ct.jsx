/**
 * Debug tests for MockEmpiricaProvider reactivity
 *
 * These tests isolate the mock harness without making Daily API calls,
 * allowing us to diagnose why player.set() updates don't propagate to
 * child components using usePlayer().
 */

import { test, expect } from '@playwright/experimental-ct-react';
import React from 'react';
import { PlayerReader } from './debug-components/PlayerReader';
import { PlayerWriter } from './debug-components/PlayerWriter';
import { PlayerIdentityTracker } from './debug-components/PlayerIdentityTracker';

test.describe('MockEmpiricaProvider Reactivity Debug', () => {
  test('TEST 1: Player reader sees initial attributes', async ({ mount, page }) => {
    const config = {
      empirica: {
        currentPlayerId: 'p0',
        players: [
          { id: 'p0', attrs: { position: '0', name: 'Test Player' } },
        ],
        game: { attrs: {} },
        stage: { attrs: {} },
      },
    };

    await mount(<PlayerReader />, { hooksConfig: config });

    // Check that initial attributes are visible
    await expect(page.locator('[data-test="playerId"]')).toHaveText('p0');
    await expect(page.locator('[data-test="position"]')).toHaveText('0');
    await expect(page.locator('[data-test="dailyId"]')).toHaveText('null');

    const state = await page.evaluate(() => window.playerReaderState);
    console.log('Initial state:', state);
    expect(state.playerId).toBe('p0');
    expect(state.position).toBe('0');
    expect(state.dailyId).toBeNull();
  });

  test('TEST 2: Player reader updates when player.set() is called from browser', async ({ mount, page }) => {
    const config = {
      empirica: {
        currentPlayerId: 'p0',
        players: [
          { id: 'p0', attrs: { position: '0' } },
        ],
        game: { attrs: {} },
        stage: { attrs: {} },
      },
    };

    await mount(<PlayerReader />, { hooksConfig: config });

    // Initial state
    await expect(page.locator('[data-test="dailyId"]')).toHaveText('null');
    const initialState = await page.evaluate(() => window.playerReaderState);
    console.log('Initial state:', initialState);

    // Call player.set() from browser context
    await page.evaluate(() => {
      const player = window.mockEmpiricaContext.players[0];
      console.log('[TEST] Calling player.set(dailyId, new-daily-id)');
      player.set('dailyId', 'new-daily-id');
    });

    // Wait a bit for re-render
    await page.waitForTimeout(500);

    // Check if component updated
    const updatedState = await page.evaluate(() => window.playerReaderState);
    console.log('Updated state:', updatedState);

    // CRITICAL TEST: Did the component re-render with new data?
    console.log('\n=== REACTIVITY CHECK ===');
    console.log(`Render count: ${initialState.renderCount} -> ${updatedState.renderCount}`);
    console.log(`Daily ID: ${initialState.dailyId} -> ${updatedState.dailyId}`);
    console.log(`Expected: renderCount increased and dailyId = "new-daily-id"`);

    // Check the actual DOM
    const domDailyId = await page.locator('[data-test="dailyId"]').textContent();
    console.log(`DOM shows dailyId: ${domDailyId}`);

    // Verify reactivity worked
    expect(updatedState.renderCount).toBeGreaterThan(initialState.renderCount);
    expect(updatedState.dailyId).toBe('new-daily-id');
    await expect(page.locator('[data-test="dailyId"]')).toHaveText('new-daily-id');
  });

  test('TEST 3: Player reader updates when sibling component calls player.set()', async ({ mount, page }) => {
    const config = {
      empirica: {
        currentPlayerId: 'p0',
        players: [
          { id: 'p0', attrs: { position: '0' } },
        ],
        game: { attrs: {} },
        stage: { attrs: {} },
      },
    };

    // Mount both reader and writer
    await mount(
      <>
        <PlayerReader />
        <PlayerWriter />
      </>,
      { hooksConfig: config }
    );

    // Initial state
    const initialState = await page.evaluate(() => window.playerReaderState);
    console.log('Initial state:', initialState);

    // PlayerWriter calls player.set() during mount
    // Wait for potential re-renders
    await page.waitForTimeout(500);

    // Check if PlayerReader updated
    const updatedState = await page.evaluate(() => window.playerReaderState);
    console.log('Updated state after writer mount:', updatedState);

    console.log('\n=== SIBLING REACTIVITY CHECK ===');
    console.log(`Render count: ${initialState.renderCount} -> ${updatedState.renderCount}`);
    console.log(`Daily ID: ${initialState.dailyId} -> ${updatedState.dailyId}`);
    console.log(`Position: ${initialState.position} -> ${updatedState.position}`);

    // Verify reactivity worked across siblings
    expect(updatedState.renderCount).toBeGreaterThan(initialState.renderCount);
    expect(updatedState.dailyId).toBe('test-daily-id-123');
    expect(updatedState.position).toBe('5');
  });

  test('TEST 4: Direct player instance check - verify set() mutates object', async ({ mount, page }) => {
    const config = {
      empirica: {
        currentPlayerId: 'p0',
        players: [
          { id: 'p0', attrs: { position: '0' } },
        ],
        game: { attrs: {} },
        stage: { attrs: {} },
      },
    };

    await mount(<PlayerReader />, { hooksConfig: config });

    // Check player object before and after set()
    const beforeAfter = await page.evaluate(() => {
      const player = window.mockEmpiricaContext.players[0];

      const before = {
        dailyId: player.get('dailyId'),
        hasOnChange: !!player._onChange,
        setCallCount: player.getAllSetCalls().length,
      };

      // Call set()
      player.set('dailyId', 'direct-test-id');

      const after = {
        dailyId: player.get('dailyId'),
        hasOnChange: !!player._onChange,
        setCallCount: player.getAllSetCalls().length,
      };

      return { before, after };
    });

    console.log('\n=== DIRECT MUTATION CHECK ===');
    console.log('Before:', beforeAfter.before);
    console.log('After:', beforeAfter.after);

    // Verify player object mutates correctly
    expect(beforeAfter.before.dailyId).toBeNull();
    expect(beforeAfter.after.dailyId).toBe('direct-test-id');
    expect(beforeAfter.after.setCallCount).toBeGreaterThan(beforeAfter.before.setCallCount);
    expect(beforeAfter.after.hasOnChange).toBe(true);
  });

  test('TEST 5: Monitor forceUpdate calls - does onChange trigger re-renders?', async ({ mount, page }) => {
    const config = {
      empirica: {
        currentPlayerId: 'p0',
        players: [
          { id: 'p0', attrs: { position: '0' } },
        ],
        game: { attrs: {} },
        stage: { attrs: {} },
      },
    };

    // Instrument MockEmpiricaProvider to count forceUpdate calls
    await page.evaluate(() => {
      window.mockEmpiricaDebug = {
        onChangeCallCount: 0,
      };
    });

    await mount(<PlayerReader />, { hooksConfig: config });

    // Monkey-patch the player's onChange to count calls
    await page.evaluate(() => {
      const player = window.mockEmpiricaContext.players[0];
      const originalOnChange = player._onChange;

      player._onChange = function() {
        window.mockEmpiricaDebug.onChangeCallCount += 1;
        console.log(`[DEBUG] onChange called (count: ${window.mockEmpiricaDebug.onChangeCallCount})`);
        if (originalOnChange) {
          originalOnChange.call(this);
        }
      };
    });

    const initialRenderCount = await page.evaluate(() => window.playerReaderState.renderCount);

    // Call player.set() multiple times
    await page.evaluate(() => {
      const player = window.mockEmpiricaContext.players[0];
      player.set('dailyId', 'first-id');
      player.set('position', '1');
      player.set('dailyId', 'second-id');
    });

    await page.waitForTimeout(500);

    const debug = await page.evaluate(() => window.mockEmpiricaDebug);
    const finalRenderCount = await page.evaluate(() => window.playerReaderState.renderCount);

    console.log('\n=== FORCE UPDATE CHECK ===');
    console.log(`onChange called: ${debug.onChangeCallCount} times`);
    console.log(`Component rendered: ${initialRenderCount} -> ${finalRenderCount} (delta: ${finalRenderCount - initialRenderCount})`);
    console.log('Expected: onChange count = 3, render count increased by ~3');

    // Verify onChange is called
    expect(debug.onChangeCallCount).toBe(3);

    // Verify component re-rendered
    expect(finalRenderCount).toBeGreaterThan(initialRenderCount);
  });

  test('TEST 6: Track player object identity across re-renders', async ({ mount, page }) => {
    // Set up console listener BEFORE mounting
    const consoleLogs = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[MockEmpiricaProvider]') || text.includes('[PlayerIdentityTracker]')) {
        consoleLogs.push(text);
      }
    });

    const config = {
      empirica: {
        currentPlayerId: 'p0',
        players: [
          { id: 'p0', attrs: { position: '0' } },
        ],
        game: { attrs: {} },
        stage: { attrs: {} },
      },
    };

    await mount(<PlayerIdentityTracker />, { hooksConfig: config });

    // Wait for initial render
    await page.waitForTimeout(100);

    // Call player.set() to trigger re-render
    await page.evaluate(() => {
      const player = window.mockEmpiricaContext.players[0];
      player.set('dailyId', 'identity-test-id');
    });

    // Wait for re-renders to settle
    await page.waitForTimeout(500);

    // Get tracking data
    const tracking = await page.evaluate(() => window.playerIdentityTracking);

    console.log('\n=== BROWSER CONSOLE LOGS ===');
    consoleLogs.forEach((log) => console.log(log));

    console.log('\n=== PLAYER IDENTITY TRACKING ===');
    tracking.forEach((entry, idx) => {
      console.log(`Render ${idx + 1}:`, {
        isSameInstance: entry.isSameInstanceAsPrevious,
        dailyId: entry.dailyId,
      });
    });

    // Check if player instance changes across renders
    const instanceChanges = tracking.filter((entry, idx) => {
      return idx > 0 && entry.isSameInstanceAsPrevious === false;
    });

    console.log(`\nTotal renders: ${tracking.length}`);
    console.log(`Instance changes: ${instanceChanges.length}`);
    console.log('Expected: Instance should stay the same (0 changes), dailyId should update');

    // Verify player instance is stable
    expect(instanceChanges.length).toBe(0);

    // Verify dailyId eventually updates (check last render)
    const lastRender = tracking[tracking.length - 1];
    expect(lastRender.dailyId).toBe('identity-test-id');
  });
});
