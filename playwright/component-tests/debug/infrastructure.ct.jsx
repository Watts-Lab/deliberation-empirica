import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { MockPlayer } from '../../mocks/MockPlayer.js';
import { MockGame } from '../../mocks/MockGame.js';
import { MockEmpiricaProvider } from '../../mocks/MockEmpiricaProvider.jsx';

test.describe('Mock Infrastructure', () => {
  test('MockEmpiricaProvider exposes context on window', async ({ mount, page }) => {
    const players = [new MockPlayer('p0', { position: '0' })];
    const game = new MockGame({ dailyUrl: 'https://test.daily.co/room' });

    await mount(
      <MockEmpiricaProvider currentPlayerId="p0" players={players} game={game}>
        <div data-test="test">Test</div>
      </MockEmpiricaProvider>
    );

    const contextCheck = await page.evaluate(() => {
      const ctx = window.mockEmpiricaContext;
      return {
        hasContext: !!ctx,
        currentPlayerId: ctx?.currentPlayerId,
        playerCount: ctx?.players?.length,
        playerId: ctx?.players?.[0]?.id,
      };
    });

    expect(contextCheck.hasContext).toBe(true);
    expect(contextCheck.currentPlayerId).toBe('p0');
    expect(contextCheck.playerCount).toBe(1);
    expect(contextCheck.playerId).toBe('p0');
  });

  test('window.mockPlayers (direct) vs context players', async ({ mount, page }) => {
    // Use the NEW API (playerConfigs) to preserve prototypes
    const playerConfigs = [{ id: 'p0', attrs: { position: '0' } }];
    const gameConfig = { attrs: { dailyUrl: 'https://test.daily.co/room' } };

    await mount(
      <MockEmpiricaProvider
        currentPlayerId="p0"
        playerConfigs={playerConfigs}
        gameConfig={gameConfig}
      >
        <div data-test="test">Test</div>
      </MockEmpiricaProvider>
    );

    const comparison = await page.evaluate(() => {
      const directPlayer = window.mockPlayers?.[0];
      const contextPlayer = window.mockEmpiricaContext?.players?.[0];

      return {
        direct: {
          exists: !!directPlayer,
          hasSetMethod: typeof directPlayer?.set === 'function',
          constructor: directPlayer?.constructor?.name,
          protoKeys: directPlayer ? Object.getOwnPropertyNames(Object.getPrototypeOf(directPlayer)) : [],
        },
        context: {
          exists: !!contextPlayer,
          hasSetMethod: typeof contextPlayer?.set === 'function',
          constructor: contextPlayer?.constructor?.name,
          protoKeys: contextPlayer ? Object.getOwnPropertyNames(Object.getPrototypeOf(contextPlayer)) : [],
        },
        areSame: directPlayer === contextPlayer,
      };
    });

    console.log('[Test] Comparison:', JSON.stringify(comparison, null, 2));

    expect(comparison.direct.hasSetMethod).toBe(true);
  });
});
