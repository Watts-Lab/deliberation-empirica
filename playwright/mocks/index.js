import { MockPlayer } from './MockPlayer.js';
import { MockGame } from './MockGame.js';
import { MockStage } from './MockStage.js';

export { MockPlayer, MockGame, MockStage };

/**
 * Create a complete mock Empirica context for component tests
 *
 * @param {Object} config - Configuration options
 * @param {string} config.playerId - Current player ID
 * @param {string} config.playerName - Current player name
 * @param {string} config.playerPosition - Current player position
 * @param {string|null} config.playerRoom - Current player room (for breakout rooms)
 * @param {Object} config.playerAttributes - Additional player attributes
 * @param {Array} config.otherPlayers - Array of other player configs: [{ id, attributes }]
 * @param {string|null} config.roomUrl - Daily.co room URL
 * @param {Object} config.gameAttributes - Additional game attributes
 * @param {Object} config.stageAttributes - Additional stage attributes
 * @returns {Object} Mock Empirica context with { player, players, game, stage }
 */
export function createMockEmpiricaContext(config = {}) {
  const {
    playerId = 'player-0',
    playerName = 'Test User',
    playerPosition = '0',
    playerRoom = null,
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
    room: playerRoom,
    ...playerAttributes,
  });

  // Create other players
  const players = [
    player,
    ...otherPlayers.map(p => new MockPlayer(p.id, p.attributes)),
  ];

  // Create game
  const game = new MockGame({
    roomUrl,
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
