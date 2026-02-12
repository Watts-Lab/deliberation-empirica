/**
 * Mock exports for Playwright component tests
 *
 * This module provides all the mocking infrastructure for testing
 * components that depend on Empirica and Daily.co.
 */

// --------------- Core Mock Classes ---------------
// These are the stateful mock objects that track get/set/append calls

import { MockPlayer } from './MockPlayer.js';
import { MockGame } from './MockGame.js';
import { MockStage } from './MockStage.js';

export { MockPlayer, MockGame, MockStage };

// --------------- Providers ---------------
// Wrap components with these providers to inject mock state

export { MockEmpiricaProvider, MockEmpiricaContext } from './MockEmpiricaProvider.jsx';
export { MockDailyProvider, MockDailyContext } from './MockDailyProvider.jsx';

// --------------- Helper Functions ---------------

/**
 * Create a set of mock objects for testing
 *
 * This is a convenience helper that creates MockPlayer, MockGame, and MockStage
 * objects with the given configuration. Use these objects with MockEmpiricaProvider.
 *
 * @param {Object} config - Configuration options
 * @param {string} config.playerId - Current player ID
 * @param {string} config.playerName - Current player name
 * @param {string} config.playerPosition - Current player position
 * @param {Object} config.playerAttributes - Additional player attributes
 * @param {Array} config.otherPlayers - Array of other player configs: [{ id, attributes }]
 * @param {string|null} config.roomUrl - Daily.co room URL (stored as dailyUrl in game)
 * @param {Object} config.gameAttributes - Additional game attributes
 * @param {Object} config.stageAttributes - Additional stage attributes
 * @returns {Object} { player, players, game, stage }
 *
 * @example
 * const { players, game, stage } = createMockObjects({
 *   playerId: 'p0',
 *   playerName: 'Test User',
 *   playerPosition: '0',
 *   roomUrl: 'https://test.daily.co/room',
 *   otherPlayers: [
 *     { id: 'p1', attributes: { name: 'Player 2', position: '1' } }
 *   ],
 * });
 *
 * <MockEmpiricaProvider
 *   currentPlayerId="p0"
 *   players={players}
 *   game={game}
 *   stage={stage}
 * >
 *   <VideoCall />
 * </MockEmpiricaProvider>
 */
export function createMockObjects(config = {}) {
  const {
    playerId = 'player-0',
    playerName = 'Test User',
    playerPosition = '0',
    playerAttributes = {},
    otherPlayers = [],
    roomUrl = null,
    gameAttributes = {},
    stageAttributes = {},
  } = config;

  // Create current player
  const player = new MockPlayer(playerId, {
    name: playerName,
    position: playerPosition,
    ...playerAttributes,
  });

  // Create all players (current + others)
  const players = [
    player,
    ...otherPlayers.map(p => new MockPlayer(p.id, p.attributes)),
  ];

  // Create game with dailyUrl
  const game = new MockGame({
    dailyUrl: roomUrl,
    ...gameAttributes,
  });

  // Create stage
  const stage = new MockStage(stageAttributes);

  return {
    player,
    players,
    game,
    stage,
  };
}

/**
 * Legacy alias for createMockObjects
 * @deprecated Use createMockObjects and MockEmpiricaProvider instead
 */
export const createMockEmpiricaContext = createMockObjects;
