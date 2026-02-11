import { createMockEmpiricaContext, MockPlayer } from '../mocks/index.js';

/**
 * Create a multi-player test scenario
 *
 * @param {Object} config
 * @param {number} config.numPlayers - Total number of players
 * @param {number} config.currentPlayerIndex - Index of the current player (0-based)
 * @param {string|null} config.roomUrl - Daily.co room URL
 * @returns {Object} Mock Empirica context
 */
export function createMultiPlayerScenario(config = {}) {
  const {
    numPlayers = 3,
    currentPlayerIndex = 0,
    roomUrl = null,
  } = config;

  const otherPlayers = [];

  for (let i = 0; i < numPlayers; i++) {
    if (i === currentPlayerIndex) continue; // Skip current player

    otherPlayers.push({
      id: `player-${i}`,
      attributes: {
        name: `Player ${i}`,
        position: String(i),
        dailyId: null, // Will be set when they "join"
      },
    });
  }

  return createMockEmpiricaContext({
    playerId: `player-${currentPlayerIndex}`,
    playerName: `Player ${currentPlayerIndex}`,
    playerPosition: String(currentPlayerIndex),
    otherPlayers,
    roomUrl,
  });
}

/**
 * Create a breakout room test scenario
 *
 * @param {Object} config
 * @param {number} config.totalPlayers - Total number of players
 * @param {number} config.playersPerRoom - Number of players per breakout room
 * @param {number} config.currentPlayerIndex - Index of current player
 * @param {Object} config.roomUrls - Map of room names to Daily.co URLs
 * @returns {Object} Mock Empirica context
 */
export function createBreakoutRoomScenario(config = {}) {
  const {
    totalPlayers = 6,
    playersPerRoom = 2,
    currentPlayerIndex = 0,
    roomUrls = {},
  } = config;

  const currentPlayerRoom = `room${Math.floor(currentPlayerIndex / playersPerRoom)}`;
  const otherPlayers = [];

  for (let i = 0; i < totalPlayers; i++) {
    if (i === currentPlayerIndex) continue;

    const room = `room${Math.floor(i / playersPerRoom)}`;

    otherPlayers.push({
      id: `player-${i}`,
      attributes: {
        name: `Player ${i}`,
        position: String(i),
        room,
        dailyId: null,
      },
    });
  }

  return createMockEmpiricaContext({
    playerId: `player-${currentPlayerIndex}`,
    playerName: `Player ${currentPlayerIndex}`,
    playerPosition: String(currentPlayerIndex),
    playerRoom: currentPlayerRoom,
    otherPlayers,
    gameAttributes: {
      breakoutRooms: roomUrls,
    },
  });
}

/**
 * Simulate a player joining Daily.co (sets dailyId and optional sessionId)
 *
 * @param {MockPlayer} mockPlayer - The mock player object
 * @param {string} dailyId - Daily.co participant ID
 * @param {string|null} sessionId - Optional session ID
 * @returns {MockPlayer} The same mock player (for chaining)
 */
export function simulatePlayerJoin(mockPlayer, dailyId, sessionId = null) {
  mockPlayer.set('dailyId', dailyId);
  if (sessionId) {
    mockPlayer.set('sessionId', sessionId);
  }
  return mockPlayer;
}

/**
 * Get all players in a specific room
 *
 * @param {Array<MockPlayer>} players - Array of mock players
 * @param {string} room - Room name
 * @returns {Array<MockPlayer>} Players in the specified room
 */
export function getPlayersInRoom(players, room) {
  return players.filter(p => p.get('room') === room);
}
