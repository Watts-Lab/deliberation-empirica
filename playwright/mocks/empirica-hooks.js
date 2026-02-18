/**
 * ============================================================================
 * Mock Empirica Hooks - The Bridge Between React and Mock State
 * ============================================================================
 *
 * This module provides React hooks that read from MockEmpiricaContext. In
 * component tests, these hooks are aliased to replace the real Empirica hooks
 * via Vite config:
 *
 *   resolve: {
 *     alias: {
 *       '@empirica/core/player/classic/react': './mocks/empirica-hooks.js'
 *     }
 *   }
 *
 * When components import and call usePlayer(), they get our mock implementation
 * instead of the real one, allowing full control over the test environment.
 *
 * ## How These Hooks Participate in Reactivity:
 *
 * 1. Component calls usePlayer()
 * 2. Hook calls useContext(MockEmpiricaContext)
 * 3. React returns the current contextValue from MockEmpiricaProvider
 * 4. Hook finds and returns the player instance
 * 5. Component calls player.get('key') and uses the value
 * 6. Later, player.set('key', newValue) is called
 * 7. MockPlayer.set() calls _onChange() → Provider re-renders
 * 8. Provider creates NEW contextValue (renderCount changed)
 * 9. React Context propagates: THIS component re-renders (step 1 again)
 * 10. useContext returns new contextValue with SAME player instance
 * 11. Component calls player.get('key') again, sees newValue!
 *
 * The magic is that player INSTANCE is stable (same object reference) due to
 * Provider's useMemo, but the data INSIDE it (_attributes) has been mutated.
 *
 * @see MockEmpiricaProvider.jsx - Creates the context and manages reactivity
 * @see MockPlayer.js - Implements the mutable state pattern
 */

import { useContext } from 'react';
import { MockEmpiricaContext } from './MockEmpiricaProvider.jsx';

/**
 * Get the current player object
 *
 * Returns the player instance that represents "this" player/browser/tab.
 * In real Empirica, each client connects with a unique player ID and only
 * sees their own player data via this hook. We simulate this by:
 *
 * 1. Provider stores currentPlayerId (which player this view represents)
 * 2. Provider stores players array (shared across all "clients")
 * 3. This hook finds the player with matching ID
 *
 * ## Multi-Player Testing:
 * Tests can mount multiple components with different currentPlayerId values
 * but the SAME players array, simulating multiple clients:
 *
 * ```javascript
 * const players = [
 *   new MockPlayer('p0', {...}),
 *   new MockPlayer('p1', {...}),
 * ];
 *
 * // Player 0's view
 * <MockEmpiricaProvider currentPlayerId="p0" players={players}>
 *   <VideoCall />  // This sees player p0
 * </MockEmpiricaProvider>
 *
 * // Player 1's view (same players array!)
 * <MockEmpiricaProvider currentPlayerId="p1" players={players}>
 *   <VideoCall />  // This sees player p1
 * </MockEmpiricaProvider>
 * ```
 *
 * When p0 calls `player.set('ready', true)`, the change is stored in the
 * MockPlayer instance in the shared players array. When Provider re-renders
 * both views, p0's component sees their own ready status, and p1's component
 * can access it via `players.find(p => p.id === 'p0').get('ready')`.
 *
 * ## Return Value Stability:
 * This hook returns the SAME MockPlayer instance across re-renders (as long
 * as currentPlayerId doesn't change). This is critical for the reactivity
 * system - if the instance changed, all mutations would be lost.
 *
 * The instance is stable because:
 * 1. Provider's useMemo keeps players array stable (same array reference)
 * 2. Array contains same MockPlayer instances (not recreated)
 * 3. find() returns the same instance by reference equality
 *
 * @returns {MockPlayer|null} The current player instance, or null if no match
 */
export function usePlayer() {
  const ctx = useContext(MockEmpiricaContext);
  if (!ctx) {
    console.warn('usePlayer called outside MockEmpiricaProvider');
    return null;
  }
  const { currentPlayerId, players } = ctx;
  return players.find(p => p.id === currentPlayerId) || null;
}

/**
 * Get all players in the game
 *
 * Returns the complete players array, including the current player and all
 * other players. This allows components to:
 * - Render a list of all participants
 * - Check other players' states (e.g., who has submitted)
 * - Coordinate multi-player interactions
 *
 * Example:
 * ```javascript
 * const players = usePlayers()
 * const allReady = players.every(p => p.get('ready'))
 * ```
 *
 * Like usePlayer(), this returns the SAME array instance across re-renders
 * (Provider's useMemo keeps it stable). When ANY player's state changes via
 * set()/append(), the Provider re-renders and this hook returns the same
 * array with the same player instances - but those instances have mutated
 * internal state.
 *
 * @returns {Array<MockPlayer>} Array of all player instances (stable reference)
 */
export function usePlayers() {
  const ctx = useContext(MockEmpiricaContext);
  if (!ctx) {
    console.warn('usePlayers called outside MockEmpiricaProvider');
    return [];
  }
  return ctx.players;
}

/**
 * Get the game object
 *
 * Returns the shared game instance containing game-level state like:
 * - dailyUrl: Video call room URL
 * - treatment: Experimental condition
 * - Game-wide timers, configuration, etc.
 *
 * All players share the same game object. When any player (or the test)
 * calls game.set(), all players see the change after the Provider re-renders.
 *
 * Same reactivity pattern as usePlayer():
 * - Returns SAME MockGame instance across re-renders
 * - Instance has mutable _attributes
 * - Changes trigger re-renders via _onChange
 *
 * @returns {MockGame|null} The shared game instance, or null if not set
 */
export function useGame() {
  const ctx = useContext(MockEmpiricaContext);
  if (!ctx) {
    console.warn('useGame called outside MockEmpiricaProvider');
    return null;
  }
  return ctx.game;
}

/**
 * Get the current stage object
 *
 * Returns the shared stage instance containing stage-level state like:
 * - discussion: Current discussion topic
 * - callStarted: Whether video call has begun
 * - Stage-specific configuration, timers, etc.
 *
 * ⚠️  IMPORTANT: This is DIFFERENT from player.stage!
 * - useStage() / stage.get(): Shared across ALL players
 * - player.stage.get(): Per-player stage data (unique to each player)
 *
 * Example:
 * ```javascript
 * // Shared stage data (all players see the same value)
 * const stage = useStage()
 * const topic = stage.get('discussion')  // Same for everyone
 *
 * // Per-player stage data (each player has their own value)
 * const player = usePlayer()
 * const voted = player.stage.get('hasVoted')  // Unique per player
 * ```
 *
 * Same reactivity pattern as other hooks - returns stable instance with
 * mutable state.
 *
 * @returns {MockStage|null} The shared stage instance, or null if not set
 */
export function useStage() {
  const ctx = useContext(MockEmpiricaContext);
  if (!ctx) {
    console.warn('useStage called outside MockEmpiricaProvider');
    return null;
  }
  return ctx.stage;
}

/**
 * Get the stage timer
 *
 * Returns timer object with elapsed time in milliseconds.
 *
 * @returns {Object|null} Timer object with elapsed property
 */
export function useStageTimer() {
  const ctx = useContext(MockEmpiricaContext);
  if (!ctx) {
    console.warn('useStageTimer called outside MockEmpiricaProvider');
    return null;
  }
  return ctx.stageTimer;
}

/**
 * Get the current round (not commonly used in VideoCall tests)
 *
 * @returns {null} Always returns null for mock
 */
export function useRound() {
  return null;
}

// --------------- Progress Label Hooks ---------------
// These are also exported from this module and aliased from
// '../components/progressLabel' and '../../components/progressLabel'

/**
 * Get the current progress label string
 *
 * Format: "{phase}_{index}_{name}" (e.g., "game_0_discussion")
 *
 * @returns {string} Progress label
 */
export function useProgressLabel() {
  const ctx = useContext(MockEmpiricaContext);
  if (!ctx) {
    console.warn('useProgressLabel called outside MockEmpiricaProvider');
    return 'test_0_unknown';
  }
  return ctx.progressLabel;
}

/**
 * Get a function that returns current elapsed time in seconds
 *
 * The returned function can be called multiple times and will
 * return the current elapsed time (useful for logging events
 * at different points during a stage).
 *
 * @returns {Function} Function that returns elapsed seconds
 */
export function useGetElapsedTime() {
  const ctx = useContext(MockEmpiricaContext);
  if (!ctx) {
    console.warn('useGetElapsedTime called outside MockEmpiricaProvider');
    return () => 0;
  }
  return ctx.getElapsedTime;
}

/**
 * Compute a progress label from parts (pure utility function)
 *
 * @param {Object} params
 * @param {string} params.phase - Phase name (e.g., 'intro', 'game', 'exit')
 * @param {number} params.index - Index within phase
 * @param {string} params.name - Name of the step
 * @returns {string} Progress label
 */
export function computeProgressLabel({ phase, index, name }) {
  return `${phase}_${index}_${name}`;
}

// --------------- Provider Components (pass-through) ---------------
// These are the provider components from progressLabel module.
// In tests, we use MockEmpiricaProvider instead, so these just pass through.

export function StageProgressLabelProvider({ children }) {
  return children;
}

export function IntroExitProgressLabelProvider({ children }) {
  return children;
}
