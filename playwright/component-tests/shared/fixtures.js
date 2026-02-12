/**
 * Common test configurations for VideoCall component tests.
 *
 * Import and use these to avoid duplicating config across test files.
 *
 * Usage:
 *   import { singlePlayerConnected } from '../shared/fixtures';
 *
 *   const component = await mount(<VideoCall showSelfView />, {
 *     hooksConfig: singlePlayerConnected,
 *   });
 */

/**
 * Single player, fully connected with video and audio on
 */
export const singlePlayerConnected = {
  empirica: {
    currentPlayerId: 'p0',
    players: [{ id: 'p0', attrs: { name: 'Test User', position: '0', dailyId: 'daily-p0' } }],
    game: { attrs: { dailyUrl: 'https://test.daily.co/room' } },
    stage: { attrs: {} },
    stageTimer: { elapsed: 0 },
  },
  daily: {
    localSessionId: 'daily-p0',
    participantIds: ['daily-p0'],
    videoTracks: { 'daily-p0': { isOff: false, subscribed: true } },
    audioTracks: { 'daily-p0': { isOff: false, subscribed: true } },
  },
};

/**
 * Single player, video muted
 */
export const singlePlayerVideoMuted = {
  empirica: {
    currentPlayerId: 'p0',
    players: [{ id: 'p0', attrs: { name: 'Test User', position: '0', dailyId: 'daily-p0' } }],
    game: { attrs: { dailyUrl: 'https://test.daily.co/room' } },
    stage: { attrs: {} },
    stageTimer: { elapsed: 0 },
  },
  daily: {
    localSessionId: 'daily-p0',
    participantIds: ['daily-p0'],
    videoTracks: { 'daily-p0': { isOff: true, subscribed: true } },
    audioTracks: { 'daily-p0': { isOff: false, subscribed: true } },
  },
};

/**
 * Single player, not connected to Daily yet (no session)
 */
export const singlePlayerNotConnected = {
  empirica: {
    currentPlayerId: 'p0',
    players: [{ id: 'p0', attrs: { name: 'Test User', position: '0' } }],
    game: { attrs: { dailyUrl: 'https://test.daily.co/room' } },
    stage: { attrs: {} },
    stageTimer: { elapsed: 0 },
  },
  daily: {
    localSessionId: null,
    participantIds: [],
    videoTracks: {},
    audioTracks: {},
  },
};

/**
 * Two players - I'm connected, other player hasn't joined Daily yet
 */
export const twoPlayersOneWaiting = {
  empirica: {
    currentPlayerId: 'p0',
    players: [
      { id: 'p0', attrs: { name: 'Player 0', position: '0', dailyId: 'daily-p0' } },
      { id: 'p1', attrs: { name: 'Player 1', position: '1' } }, // No dailyId - not connected
    ],
    game: { attrs: { dailyUrl: 'https://test.daily.co/room' } },
    stage: { attrs: {} },
    stageTimer: { elapsed: 0 },
  },
  daily: {
    localSessionId: 'daily-p0',
    participantIds: ['daily-p0'], // Only I'm in the call
    videoTracks: { 'daily-p0': { isOff: false, subscribed: true } },
    audioTracks: { 'daily-p0': { isOff: false, subscribed: true } },
  },
};

/**
 * Three players, all connected
 */
export const threePlayersConnected = {
  empirica: {
    currentPlayerId: 'p0',
    players: [
      { id: 'p0', attrs: { name: 'Player 0', position: '0', dailyId: 'daily-p0' } },
      { id: 'p1', attrs: { name: 'Player 1', position: '1', dailyId: 'daily-p1' } },
      { id: 'p2', attrs: { name: 'Player 2', position: '2', dailyId: 'daily-p2' } },
    ],
    game: { attrs: { dailyUrl: 'https://test.daily.co/room' } },
    stage: { attrs: {} },
    stageTimer: { elapsed: 0 },
  },
  daily: {
    localSessionId: 'daily-p0',
    participantIds: ['daily-p0', 'daily-p1', 'daily-p2'],
    videoTracks: {
      'daily-p0': { isOff: false, subscribed: true },
      'daily-p1': { isOff: false, subscribed: true },
      'daily-p2': { isOff: false, subscribed: true },
    },
    audioTracks: {
      'daily-p0': { isOff: false, subscribed: true },
      'daily-p1': { isOff: false, subscribed: true },
      'daily-p2': { isOff: false, subscribed: true },
    },
  },
};
