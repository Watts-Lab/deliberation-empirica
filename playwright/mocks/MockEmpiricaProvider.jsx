import React, { createContext } from 'react';

/**
 * Mock Empirica Context for component tests
 *
 * Provides all the state that Empirica hooks would normally read from,
 * allowing tests to control player, game, stage, and timing state.
 */
export const MockEmpiricaContext = createContext(null);

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
  players = [],
  game = null,
  stage = null,
  stageTimer = null,
  progressLabel = 'test_0_stage',
  elapsedTime = 0,
  children,
}) {
  // Support both static number and dynamic getter function for elapsed time
  const getElapsedTime = typeof elapsedTime === 'function'
    ? elapsedTime
    : () => elapsedTime;

  const contextValue = {
    currentPlayerId,
    players,
    game,
    stage,
    stageTimer,
    progressLabel,
    getElapsedTime,
  };

  return (
    <MockEmpiricaContext.Provider value={contextValue}>
      {children}
    </MockEmpiricaContext.Provider>
  );
}
