/**
 * Mock Empirica Hooks for component tests
 *
 * This module is aliased to replace '@empirica/core/player/classic/react'
 * in the Playwright component test Vite config.
 *
 * All hooks read from MockEmpiricaContext, which is provided by
 * MockEmpiricaProvider wrapping the test components.
 */

import { useContext } from 'react';
import { MockEmpiricaContext } from './MockEmpiricaProvider.jsx';

/**
 * Get the current player object
 *
 * Returns the player from the players array that matches currentPlayerId.
 * This simulates how each browser/tab sees "their own" player.
 *
 * @returns {MockPlayer|null} The current player object
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
 * Returns the shared players array. When any player calls set(),
 * all other players will see the change via this array.
 *
 * @returns {Array<MockPlayer>} Array of all player objects
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
 * Returns the shared game object with dailyUrl, treatment, etc.
 *
 * @returns {MockGame|null} The game object
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
 * Returns the shared stage object with callStarted, discussion, etc.
 * Note: This is different from player.stage which is per-player stage data.
 *
 * @returns {MockStage|null} The stage object
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
