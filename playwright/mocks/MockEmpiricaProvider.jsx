import React, { createContext, useState, useCallback, useLayoutEffect, useMemo } from 'react';
import { MockPlayer } from './MockPlayer.js';
import { MockGame } from './MockGame.js';
import { MockStage } from './MockStage.js';

/**
 * ============================================================================
 * MockEmpiricaProvider - Reactive State Management for Component Tests
 * ============================================================================
 *
 * This provider enables testing Empirica components in isolation by providing
 * mock implementations of player, game, and stage objects. It implements a
 * sophisticated reactivity system that mimics how the real Empirica runtime
 * propagates state changes.
 *
 * ## How Reactivity Works
 *
 * 1. **Mutation Detection**: Mock objects (MockPlayer, MockGame, MockStage)
 *    store their state in internal `_attributes` objects. When `set()` or
 *    `append()` is called, they mutate their state AND call `_onChange()`.
 *
 * 2. **Triggering Re-renders**: The `_onChange` callback is `handleChange`,
 *    which calls `forceUpdate()` to increment `renderCount` state. This
 *    triggers a re-render of MockEmpiricaProvider.
 *
 * 3. **Stable Instance References**: The `useMemo` hooks ensure that mock
 *    object INSTANCES remain stable across re-renders (same object references).
 *    This is CRITICAL - if instances changed, all mutations would be lost!
 *
 * 4. **Context Propagation**: When `renderCount` changes, the `contextValue`
 *    useMemo creates a NEW object reference. React Context detects this change
 *    and triggers re-renders of all consumer components (usePlayer, etc.).
 *
 * 5. **Fresh Data Reads**: When consumer components re-render, they call
 *    `player.get()` which reads from the (now mutated) `_attributes` object,
 *    seeing the updated values.
 *
 * ## Critical Design Decisions
 *
 * ### Why Stable Default Values?
 * Default parameter values like `players = []` create NEW array references on
 * EVERY render. This causes `useMemo([..., players])` to re-evaluate and
 * create brand new MockPlayer instances, destroying all state. Using stable
 * references (EMPTY_PLAYERS_ARRAY) defined outside the component prevents this.
 *
 * ### Why Not Include handleChange in useMemo Deps?
 * Even though `handleChange` is stable (from useCallback with empty deps),
 * including it in useMemo dependencies caused instance re-creation in practice.
 * Since handleChange is guaranteed stable and useLayoutEffect injects it
 * anyway, it's safe to omit from dependencies.
 *
 * ### Why Memoize contextValue with renderCount?
 * The contextValue object must get a NEW reference when state changes, so
 * React Context knows to update consumers. Including `renderCount` in the
 * useMemo dependencies ensures this happens after every forceUpdate.
 *
 * @see MockPlayer.js - Explains the _attributes mutation pattern
 * @see empirica-hooks.js - Shows how usePlayer() reads from this context
 */
export const MockEmpiricaContext = createContext(null);

// ============================================================================
// Stable Default Values
// ============================================================================
// These MUST be defined outside the component! Using inline literals like
// `players = []` creates NEW references on every render, breaking useMemo.
// React's useMemo uses Object.is() for comparison:
//   [] !== [] (different references!)
//   EMPTY_PLAYERS_ARRAY === EMPTY_PLAYERS_ARRAY (same reference)
const EMPTY_PLAYERS_ARRAY = [];
const EMPTY_OBJECT = {};

/**
 * Mock Empirica Provider for component tests
 *
 * Wraps components and provides mock Empirica state via context.
 * The aliased hooks (usePlayer, useGame, etc.) read from this context.
 *
 * @param {Object} props
 * @param {string} props.currentPlayerId - ID of the player this view represents
 * @param {Array} props.players - Array of all MockPlayer objects (shared state)
 * @param {Object} props.game - MockGame object (shared state)
 * @param {Object} props.stage - MockStage object (shared state)
 * @param {Object} props.stageTimer - Timer object with elapsed property
 * @param {string} props.progressLabel - Progress label string for analytics
 * @param {number|Function} props.elapsedTime - Elapsed time (number or getter function)
 * @param {React.ReactNode} props.children - Child components to render
 *
 * @example
 * // Basic single player test
 * const players = [new MockPlayer('p0', { position: '0' })];
 * const game = new MockGame({ dailyUrl: 'https://...' });
 *
 * <MockEmpiricaProvider
 *   currentPlayerId="p0"
 *   players={players}
 *   game={game}
 * >
 *   <VideoCall />
 * </MockEmpiricaProvider>
 *
 * @example
 * // Multi-player test with shared state
 * const players = [
 *   new MockPlayer('p0', { position: '0' }),
 *   new MockPlayer('p1', { position: '1' }),
 * ];
 *
 * // Player 0's view
 * <MockEmpiricaProvider currentPlayerId="p0" players={players} game={game}>
 *   <VideoCall />
 * </MockEmpiricaProvider>
 *
 * // Player 1's view (same players array, different currentPlayerId)
 * <MockEmpiricaProvider currentPlayerId="p1" players={players} game={game}>
 *   <VideoCall />
 * </MockEmpiricaProvider>
 *
 * @example
 * // Testing time-based conditional rendering
 * let elapsed = 0;
 * <MockEmpiricaProvider elapsedTime={() => elapsed} ...>
 *   <Component />
 * </MockEmpiricaProvider>
 * // Later in test:
 * elapsed = 60;
 * // Re-render or trigger update...
 */
export function MockEmpiricaProvider({
  currentPlayerId,
  // =========================================================================
  // Two APIs Supported:
  // 1. OLD API: Pass MockPlayer/MockGame/MockStage instances directly
  //    - Problem: React serializes props, stripping prototypes/methods
  //    - Use ONLY when instances are created in test, not passed through mount()
  //
  // 2. NEW API (Recommended): Pass plain config objects
  //    - Provider creates instances internally, preserving prototypes
  //    - Use when passing through mount({ hooksConfig: {...} })
  // =========================================================================
  players = EMPTY_PLAYERS_ARRAY,  // OLD: MockPlayer instances (use stable default!)
  game = null,                     // OLD: MockGame instance
  stage = null,                    // OLD: MockStage instance
  playerConfigs = null,            // NEW: Plain objects with {id, attrs}
  gameConfig = null,               // NEW: Plain object with {attrs}
  stageConfig = null,              // NEW: Plain object with {attrs}
  stageTimer = null,
  progressLabel = 'test_0_stage',
  elapsedTime = 0,
  children,
}) {
  // =========================================================================
  // Reactivity State Management
  // =========================================================================
  // We use useState to track render count, which increments whenever a mock
  // object's state changes. This is the heart of the reactivity system:
  //
  // 1. Mock object calls player.set('key', 'value')
  // 2. MockPlayer.set() calls this._onChange() -> handleChange()
  // 3. handleChange() calls forceUpdate(n => n + 1)
  // 4. renderCount increments, triggering re-render
  // 5. contextValue useMemo creates new object (renderCount in deps)
  // 6. React Context propagates new value to all consumers
  // 7. Consumer components re-render and see fresh data via player.get()
  //
  // The second element (forceUpdate) is a state setter that we use as a
  // "force re-render" function. We don't actually use renderCount directly
  // except as a useMemo dependency.
  const [renderCount, forceUpdate] = useState(0);

  // =========================================================================
  // Change Handler - The Bridge Between Mock Objects and React
  // =========================================================================
  // This callback is injected into all mock objects as their _onChange.
  // When mock state mutates, they call this to trigger React re-renders.
  //
  // CRITICAL: Must be stable (empty deps) so useMemo doesn't see it change!
  // If handleChange reference changed, useMemo would re-create mock instances.
  const handleChange = useCallback(() => {
    console.log('[MockEmpiricaProvider] handleChange called - forcing re-render');
    forceUpdate((n) => n + 1);
  }, []);

  // =========================================================================
  // Mock Instance Creation - CRITICAL FOR STATE PRESERVATION
  // =========================================================================
  // These useMemo hooks create mock object INSTANCES and are the most critical
  // part of the reactivity system. They MUST return the SAME instances across
  // re-renders, or all state mutations will be lost!
  //
  // ## How It Works:
  // 1. On first render, create new MockPlayer/MockGame/MockStage instances
  // 2. Pass handleChange as their _onChange callback
  // 3. On subsequent re-renders (triggered by forceUpdate), useMemo checks deps
  // 4. If deps haven't changed, return SAME instances (not new ones!)
  // 5. Mock objects retain all their mutated state (_attributes)
  //
  // ## Dependency Rules:
  // - playerConfigs/gameConfig/stageConfig: If test passes new configs, recreate
  // - players/game/stage: Fallback for old API, must be stable (EMPTY_PLAYERS_ARRAY)
  // - handleChange: NOT included! Even though it's passed to constructors, it's
  //   stable from useCallback. Including it caused re-creation in practice.
  //
  // ## Why Not Include handleChange?
  // Even though handleChange is stable (useCallback with []), including it in
  // deps caused mysterious re-creation bugs. Since:
  // 1. It's guaranteed stable (empty deps)
  // 2. useLayoutEffect injects it if missing anyway
  // 3. We pass it to constructors, not read it from closure
  // ...it's safe and correct to omit it.
  //
  // ## The "Inline Default Value" Bug:
  // If players defaulted to `[]` instead of EMPTY_PLAYERS_ARRAY:
  // - Every render creates NEW array: [] !== []
  // - useMemo sees "players changed", re-evaluates
  // - Creates NEW MockPlayer instances
  // - All state (_attributes, _setCalls) lost!
  // - Components see fresh (empty) player state
  // This caused the original bug where player.set() updates were lost.
  const mockPlayers = useMemo(() => {
    if (playerConfigs) {
      return playerConfigs.map((config) => new MockPlayer(config.id, config.attrs || {}, handleChange));
    }
    // Fallback to old API (but these will have lost prototypes due to React serialization)
    return players;
  }, [playerConfigs, players]);  // handleChange intentionally omitted!

  const mockGame = useMemo(() => {
    if (gameConfig) {
      console.log('[MockEmpiricaProvider] Creating game from config');
      return new MockGame(gameConfig.attrs || {}, handleChange);
    }
    return game;
  }, [gameConfig, game]);  // handleChange intentionally omitted!

  const mockStage = useMemo(() => {
    if (stageConfig) {
      console.log('[MockEmpiricaProvider] Creating stage from config');
      return new MockStage(stageConfig.attrs || {}, handleChange);
    }
    return stage;
  }, [stageConfig, stage]);  // handleChange intentionally omitted!

  // =========================================================================
  // Change Callback Injection - Fallback for Old API
  // =========================================================================
  // When using the NEW API (playerConfigs), we pass handleChange to mock
  // constructors, so _onChange is set from the start. But when using the OLD
  // API (passing instances directly), those instances might not have _onChange
  // set. This useLayoutEffect injects it as a fallback.
  //
  // Why useLayoutEffect instead of useEffect?
  // - Runs synchronously after DOM mutations, before browser paint
  // - Ensures _onChange is set before any child components render
  // - Prevents race conditions where set() is called before injection
  //
  // Note: We include handleChange in deps here (unlike useMemo) because we're
  // not creating new instances, just mutating existing ones. If handleChange
  // somehow changed (it shouldn't), we want to update the callbacks.
  useLayoutEffect(() => {
    console.log('[MockEmpiricaProvider] Injecting onChange into mocks (if needed)');
    mockPlayers.forEach((player) => {
      if (player && !player._onChange) {
        console.log(`[MockEmpiricaProvider] Injecting onChange into player ${player.id}`);
        player._onChange = handleChange;
        // Also inject into nested player.stage object
        if (player.stage && !player.stage._onChange) {
          player.stage._onChange = handleChange;
        }
      }
    });
    if (mockGame && !mockGame._onChange) {
      console.log('[MockEmpiricaProvider] Injecting onChange into game');
      mockGame._onChange = handleChange;
    }
    if (mockStage && !mockStage._onChange) {
      console.log('[MockEmpiricaProvider] Injecting onChange into stage');
      mockStage._onChange = handleChange;
    }
  }, [mockPlayers, mockGame, mockStage, handleChange]);

  // =========================================================================
  // Elapsed Time Support
  // =========================================================================
  // Tests can pass either a static number or a getter function for elapsed
  // time. This normalizes both to a function for consistent access.
  const getElapsedTime = typeof elapsedTime === 'function'
    ? elapsedTime
    : () => elapsedTime;

  // =========================================================================
  // Context Value Creation - The Final Piece of Reactivity
  // =========================================================================
  // This is where the reactivity magic completes! When renderCount changes
  // (incremented by handleChange -> forceUpdate), this useMemo creates a
  // NEW object reference for contextValue.
  //
  // ## Why This Matters:
  // React Context compares value by reference (Object.is). When we provide
  // a new object reference, React knows to re-render all Context consumers.
  // Those consumers (usePlayer, useGame, etc.) then call player.get() and
  // see the fresh, mutated data.
  //
  // ## The Flow:
  // 1. Component calls player.set('key', 'value')
  // 2. MockPlayer mutates _attributes['key'] = 'value'
  // 3. MockPlayer calls _onChange() -> handleChange()
  // 4. handleChange calls forceUpdate(n => n + 1)
  // 5. renderCount increments: 0 -> 1
  // 6. THIS useMemo sees renderCount changed, creates NEW contextValue object
  // 7. React Context notices: oldValue !== newValue (different references)
  // 8. All useContext(MockEmpiricaContext) consumers re-render
  // 9. They call player.get('key') and receive 'value' (the mutated data)
  //
  // ## Critical Dependencies:
  // - renderCount: MUST be included! This is what triggers updates
  // - mockPlayers/mockGame/mockStage: These are the stable instance references
  // - Other props: Include for completeness, but less critical
  //
  // ## What If We Didn't Use useMemo?
  // Without useMemo, contextValue would be a new object on EVERY render,
  // which works but is inefficient. With useMemo, we only create new objects
  // when something meaningful changes (renderCount, props, etc.).
  //
  // ## What If renderCount Wasn't a Dependency?
  // Then contextValue would only change when props change. When player.set()
  // is called, renderCount would increment but contextValue would be the SAME
  // object reference. React Context wouldn't notice any change, consumers
  // wouldn't re-render, and they'd continue seeing stale data. This was
  // part of the original bug!
  const contextValue = useMemo(() => ({
    currentPlayerId,
    players: mockPlayers,    // Stable instance references (from useMemo)
    game: mockGame,
    stage: mockStage,
    stageTimer,
    progressLabel,
    getElapsedTime,
  }), [renderCount, currentPlayerId, mockPlayers, mockGame, mockStage, stageTimer, progressLabel, getElapsedTime]);

  // =========================================================================
  // Debug Helpers
  // =========================================================================
  // Expose mock objects on window for test inspection. This allows tests to:
  // 1. Directly call player.set() from page.evaluate()
  // 2. Inspect player state without going through React
  // 3. Verify that mock instances are stable across re-renders
  // 4. Debug reactivity issues by comparing window.mockPlayers to hook values
  //
  // WARNING: Use window.mockEmpiricaContext in tests, not window.mockPlayers!
  // The context value includes the full set of mock objects and metadata.
  if (typeof window !== 'undefined') {
    window.mockEmpiricaContext = contextValue;
    window.mockPlayers = mockPlayers;  // Redundant but convenient for debugging
  }

  // =========================================================================
  // Provider Rendering
  // =========================================================================
  // Finally, provide the context to all child components. When contextValue
  // changes (due to renderCount increment), React will automatically re-render
  // all components using useContext(MockEmpiricaContext) - which includes all
  // components using usePlayer(), useGame(), etc. (since those hooks call
  // useContext internally).
  return (
    <MockEmpiricaContext.Provider value={contextValue}>
      {children}
    </MockEmpiricaContext.Provider>
  );
}
