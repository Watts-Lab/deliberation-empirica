/**
 * Playwright Component Test Entry Point
 *
 * This file is imported by index.html and sets up the test environment.
 * The beforeMount hook wraps components with mock providers based on hooksConfig.
 */

// Import WindiCSS for utility classes (flex, h-full, etc.)
import 'virtual:windi.css';

import React from 'react';
import { beforeMount } from '@playwright/experimental-ct-react/hooks';
import { MockEmpiricaProvider } from './mocks/MockEmpiricaProvider.jsx';
import { MockDailyProvider } from './mocks/MockDailyProvider.jsx';
import { MockPlayer } from './mocks/MockPlayer.js';
import { MockGame } from './mocks/MockGame.js';
import { MockStage } from './mocks/MockStage.js';

console.log('[Playwright CT] index.jsx loaded');

/**
 * Create mock players from serialized config
 */
function createPlayers(playerConfigs) {
  if (!playerConfigs) return [];
  return playerConfigs.map((config) => new MockPlayer(config.id, config.attrs || {}));
}

/**
 * Create mock game from serialized config
 */
function createGame(gameConfig) {
  if (!gameConfig) return null;
  return new MockGame(gameConfig.attrs || {});
}

/**
 * Create mock stage from serialized config
 */
function createStage(stageConfig) {
  if (!stageConfig) return null;
  return new MockStage(stageConfig?.attrs || {});
}

/**
 * Register beforeMount hook - wraps the component with providers
 */
beforeMount(async ({ App, hooksConfig }) => {
  console.log('[Playwright CT] beforeMount called with hooksConfig:', hooksConfig);

  // If no config provided, just render the app directly
  if (!hooksConfig) {
    console.log('[Playwright CT] No hooksConfig, rendering App directly');
    return <App />;
  }

  const { empirica, daily } = hooksConfig;
  console.log('[Playwright CT] empirica config:', empirica);
  console.log('[Playwright CT] daily config:', daily);

  // Create mock objects from serialized config
  const players = createPlayers(empirica?.players);
  const game = createGame(empirica?.game);
  const stage = createStage(empirica?.stage);

  console.log('[Playwright CT] Created players:', players.length);

  // Build the wrapped component tree
  // Wrap in a container with explicit dimensions for components that use ResizeObserver.
  // Key insight: `height: 100%` (Tailwind's h-full) doesn't work with flex-computed heights.
  // We must use explicit height values all the way down the chain.
  let wrapped = (
    <div style={{
      width: '800px',
      height: '600px',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }}>
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}>
        <App />
      </div>
    </div>
  );

  if (daily) {
    wrapped = <MockDailyProvider {...daily}>{wrapped}</MockDailyProvider>;
  }

  if (empirica) {
    wrapped = (
      <MockEmpiricaProvider
        currentPlayerId={empirica.currentPlayerId}
        players={players}
        game={game}
        stage={stage}
        stageTimer={empirica.stageTimer}
        progressLabel={empirica.progressLabel}
        elapsedTime={empirica.elapsedTime}
      >
        {wrapped}
      </MockEmpiricaProvider>
    );
  }

  return wrapped;
});
