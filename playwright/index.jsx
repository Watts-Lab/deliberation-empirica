/**
 * ============================================================================
 * Playwright Component Test Entry Point
 * ============================================================================
 *
 * This file sets up the test environment and wires everything together. It's
 * loaded by Playwright's index.html and runs in the BROWSER context (not the
 * Node.js test runner context).
 *
 * ## Key Responsibilities:
 *
 * 1. **Import Styles**: Load WindiCSS for utility classes
 * 2. **Register beforeMount Hook**: Wrap test components with mock providers
 * 3. **Bridge Test → Browser**: Convert serialized test configs into mock instances
 *
 * ## The Test Data Flow:
 *
 * ```
 * Test File (Node.js):
 *   const config = {
 *     empirica: {
 *       currentPlayerId: 'p0',
 *       players: [{ id: 'p0', attrs: {...} }],  // Plain objects (serializable)
 *       game: { attrs: {...} },
 *       stage: { attrs: {...} }
 *     }
 *   }
 *   await mount(<VideoCall />, { hooksConfig: config })
 *
 * Playwright:
 *   - Serializes config to JSON
 *   - Sends to browser via IPC
 *   - Deserializes in browser
 *
 * beforeMount Hook (THIS FILE, Browser Context):
 *   - Receives hooksConfig (plain objects, prototypes stripped!)
 *   - Creates MockPlayer/MockGame/MockStage instances (restores prototypes)
 *   - Wraps <App> with MockEmpiricaProvider and MockDailyProvider
 *   - Passes configs (not instances!) to Provider as props
 *
 * MockEmpiricaProvider (Browser Context):
 *   - Receives playerConfigs (plain objects)
 *   - Creates MockPlayer instances internally via useMemo
 *   - Provides via React Context
 *
 * Component (Browser Context):
 *   - Calls usePlayer() hook
 *   - Gets MockPlayer instance with full prototype
 *   - Can call player.set(), player.get(), etc.
 * ```
 *
 * ## Why Two Instance Creation Points?
 *
 * We create instances in TWO places:
 *
 * 1. **THIS FILE (beforeMount)**: Creates instances from test configs, but
 *    then passes CONFIGS (not instances) to Provider. This seems redundant,
 *    but it's historical and could be cleaned up.
 *
 * 2. **MockEmpiricaProvider**: Creates instances from configs via useMemo.
 *    This is the CRITICAL creation point - these are the actual instances
 *    that hooks return and must remain stable.
 *
 * The beforeMount instances are immediately discarded. The real instances
 * come from Provider's useMemo. We could skip beforeMount creation entirely
 * and just pass configs directly to Provider.
 *
 * @see MockEmpiricaProvider.jsx - Where mock instances are actually created
 * @see empirica-hooks.js - How components access mock instances
 * @see MockPlayer.js - The mutable state pattern
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
 *
 * ⚠️  NOTE: These instances are created but NOT actually used! They're
 * immediately discarded. The REAL instances that hooks return are created by
 * MockEmpiricaProvider's useMemo. This function is historical cruft that
 * could be removed.
 *
 * @param {Array} playerConfigs - Array of {id, attrs} objects
 * @returns {Array<MockPlayer>} Array of MockPlayer instances (unused!)
 */
function createPlayers(playerConfigs) {
  if (!playerConfigs) return [];
  return playerConfigs.map((config) => new MockPlayer(config.id, config.attrs || {}));
}

/**
 * Create mock game from serialized config
 *
 * ⚠️  Same as createPlayers - these instances are unused. Historical cruft.
 *
 * @param {Object} gameConfig - {attrs} object
 * @returns {MockGame|null} MockGame instance (unused!)
 */
function createGame(gameConfig) {
  if (!gameConfig) return null;
  return new MockGame(gameConfig.attrs || {});
}

/**
 * Create mock stage from serialized config
 *
 * ⚠️  Same as createPlayers - these instances are unused. Historical cruft.
 *
 * @param {Object} stageConfig - {attrs} object
 * @returns {MockStage|null} MockStage instance (unused!)
 */
function createStage(stageConfig) {
  if (!stageConfig) return null;
  return new MockStage(stageConfig?.attrs || {});
}

/**
 * ============================================================================
 * beforeMount Hook - Component Wrapping & Provider Setup
 * ============================================================================
 *
 * This is called by Playwright BEFORE mounting each test component. It receives:
 * - App: The component to mount (e.g., <VideoCall />)
 * - hooksConfig: Test configuration passed via mount({ hooksConfig: {...} })
 *
 * Our job: Wrap App with mock providers based on hooksConfig, then return the
 * wrapped tree for Playwright to mount.
 *
 * ## Configuration Structure:
 *
 * ```javascript
 * hooksConfig = {
 *   empirica: {
 *     currentPlayerId: 'p0',
 *     players: [{ id: 'p0', attrs: { position: '0' } }],  // Plain objects!
 *     game: { attrs: { dailyUrl: '...' } },
 *     stage: { attrs: { discussion: '...' } },
 *     stageTimer: { elapsed: 30000 },
 *     progressLabel: 'game_0_discussion',
 *     elapsedTime: 30
 *   },
 *   daily: {
 *     // For unit tests (mocked Daily):
 *     participants: [...],
 *     localSessionId: 'abc123',
 *
 *     // For integration tests (real Daily):
 *     roomUrl: 'https://...',
 *     autoJoin: true
 *   }
 * }
 * ```
 *
 * ## Provider Wrapping Order:
 *
 * The wrapping order matters! Inner providers should be closer to the component:
 *
 * ```
 * <MockEmpiricaProvider>           ← Outer (provides player/game/stage)
 *   <DailyTestWrapper|MockDailyProvider>  ← Middle (provides Daily context)
 *     <div style={{height: 600}}>  ← Inner (provides explicit dimensions)
 *       <App />                    ← Your component
 *     </div>
 *   </DailyTestWrapper>
 * </MockEmpiricaProvider>
 * ```
 *
 * ## Critical Design Decision:
 *
 * We pass CONFIGS (plain objects) to MockEmpiricaProvider, NOT instances:
 * ```javascript
 * playerConfigs={empirica.players}  // Plain objects: [{ id, attrs }]
 * ```
 *
 * NOT:
 * ```javascript
 * players={createPlayers(empirica.players)}  // MockPlayer instances
 * ```
 *
 * WHY? React serializes props when crossing certain boundaries (like beforeMount).
 * Serialization strips class prototypes, turning MockPlayer instances into plain
 * objects. To preserve methods (set, get, append), we:
 * 1. Keep configs as plain objects through the serialization boundary
 * 2. Let MockEmpiricaProvider create instances internally
 * 3. Provider's useMemo keeps instances stable
 *
 * The createPlayers/createGame/createStage functions are historical artifacts
 * and could be removed - we don't actually use their return values.
 *
 * @see MockEmpiricaProvider.jsx - Where instances are actually created
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
  console.log('[Playground CT] daily config:', daily);

  // =========================================================================
  // Build Wrapped Component Tree
  // =========================================================================
  // We build the component tree from the inside out, wrapping App with
  // containers and providers as needed.
  //
  // ## Dimension Container - The CSS Height Chain Fix
  //
  // Components using Tailwind's `h-full` (height: 100%) require explicit
  // parent heights. CSS percentage heights don't work with flex-computed
  // heights - the parent must have an explicit pixel/vh height.
  //
  // Problem:
  // ```
  // <div style={{display: 'flex'}}>           ← No explicit height
  //   <div style={{height: '100%'}}>          ← 100% of what? Doesn't work!
  // ```
  //
  // Solution:
  // ```
  // <div style={{height: '600px'}}>           ← Explicit height
  //   <div style={{height: '100%'}}>          ← 100% of 600px = 600px ✓
  // ```
  //
  // We wrap App in TWO divs:
  // 1. Outer: Explicit pixel dimensions (800x600) to establish size
  // 2. Inner: Flex container with minHeight: 0 to prevent flex from
  //    overriding the height constraint
  //
  // This ensures components like VideoCall that use ResizeObserver and h-full
  // get the dimensions they expect.
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
        minHeight: 0,        // Critical for flex height calculations
        overflow: 'hidden',  // Prevent content from expanding beyond container
      }}>
        <App />
      </div>
    </div>
  );

  // =========================================================================
  // Wrap with Daily Provider (if needed)
  // =========================================================================
  // Tests can use EITHER real Daily.co (integration) or mocked Daily (unit).
  //
  // ## Integration Tests (Real Daily.co):
  // If hooksConfig.daily.roomUrl is provided, use real Daily.co:
  // - Import DailyTestWrapper (creates actual Daily call object)
  // - DailyTestWrapper creates call with Daily.createCallObject()
  // - Uses real Daily hooks (useVideoTrack, etc.) from @daily-co/daily-react
  // - Makes actual WebRTC connections
  // - Useful for end-to-end testing with real video/audio
  //
  // ## Unit Tests (Mocked Daily):
  // If hooksConfig.daily exists but no roomUrl, use mocked Daily:
  // - Uses MockDailyProvider (simulated Daily state)
  // - Daily hooks are aliased to return mock data
  // - No WebRTC, no network calls, fast and isolated
  // - Useful for testing UI logic without video infrastructure
  if (daily?.roomUrl) {
    // Real Daily.co integration - import DailyTestWrapper dynamically
    // Note: This only works in integration config (no Daily alias)
    const { DailyTestWrapper } = await import('./component-tests/video-call/integration/DailyTestWrapper.jsx');
    wrapped = (
      <DailyTestWrapper
        roomUrl={daily.roomUrl}
        autoJoin={daily.autoJoin !== false}  // Default to true, but allow override
        onCallCreated={daily.onCallCreated}
      >
        {wrapped}
      </DailyTestWrapper>
    );
  } else if (daily) {
    // Mocked Daily for fast unit tests
    wrapped = <MockDailyProvider {...daily}>{wrapped}</MockDailyProvider>;
  }

  // =========================================================================
  // Wrap with Empirica Provider (if needed)
  // =========================================================================
  // This is the outer-most provider and provides player/game/stage state.
  //
  // ⚠️  CRITICAL: Pass CONFIGS, not instances!
  //
  // We pass empirica.players (plain objects like [{id, attrs}]) directly,
  // NOT createPlayers(empirica.players) (MockPlayer instances). Why?
  //
  // 1. React serializes props when crossing certain boundaries
  // 2. Serialization strips class prototypes: MockPlayer → plain object
  // 3. Methods (set, get, append) are lost
  // 4. MockEmpiricaProvider recreates instances internally via useMemo
  // 5. Those internal instances are stable and have full prototypes
  //
  // This is the key to making the reactivity system work! The instances
  // created by Provider's useMemo are the REAL instances that:
  // - Hooks return to components
  // - Maintain state across re-renders
  // - Have working set/get/append methods
  // - Trigger re-renders via _onChange
  if (empirica) {
    wrapped = (
      <MockEmpiricaProvider
        currentPlayerId={empirica.currentPlayerId}
        playerConfigs={empirica.players}  // Plain objects, not instances!
        gameConfig={empirica.game}
        stageConfig={empirica.stage}
        stageTimer={empirica.stageTimer}
        progressLabel={empirica.progressLabel}
        elapsedTime={empirica.elapsedTime}
      >
        {wrapped}
      </MockEmpiricaProvider>
    );
  }

  // =========================================================================
  // Return Wrapped Component Tree
  // =========================================================================
  // Playwright will mount this tree in the browser. The component hierarchy:
  //
  // <MockEmpiricaProvider>              ← Provides player/game/stage
  //   <DailyTestWrapper|MockDailyProvider>  ← Provides Daily context
  //     <div style={{height: 600}}>    ← Explicit dimensions
  //       <App />                       ← Your test component
  //     </div>
  //   </DailyTestWrapper>
  // </MockEmpiricaProvider>
  //
  // When App renders and calls usePlayer(), it traverses up the tree:
  // 1. usePlayer() calls useContext(MockEmpiricaContext)
  // 2. React finds MockEmpiricaProvider above in tree
  // 3. Returns its contextValue
  // 4. Hook extracts and returns player instance
  // 5. Component calls player.get() and uses data
  //
  // When player.set() is called later:
  // 1. Mutates player._attributes
  // 2. Calls player._onChange() → Provider.handleChange()
  // 3. Provider calls forceUpdate() → renderCount++
  // 4. contextValue useMemo creates new object (renderCount in deps)
  // 5. React Context propagates to all consumers
  // 6. App re-renders, calls usePlayer() again
  // 7. Gets same player instance (Provider's useMemo is stable)
  // 8. Calls player.get(), sees fresh data from mutated _attributes
  //
  // The cycle continues for every state mutation!
  return wrapped;
});
