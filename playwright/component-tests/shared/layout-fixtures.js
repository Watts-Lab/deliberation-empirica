/**
 * Layout test fixtures for VideoCall component.
 *
 * These fixtures define custom layouts, breakout rooms, and other
 * layout configurations from the Cypress discussionLayout test suite.
 */

/**
 * Base 3-player setup - all connected with video/audio
 */
const baseThreePlayers = {
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

/**
 * Default layout - no custom layout, all 3 players visible
 */
export const defaultLayout = {
  ...baseThreePlayers,
  layout: undefined, // Use default responsive layout
};

/**
 * 2x2 Grid Layout - Custom grid positioning
 * Player 0's view: sees Player 1 (top-left), self (bottom-left), Player 2 (top-right)
 */
export const twoByTwoGrid = {
  ...baseThreePlayers,
  layout: {
    0: {
      grid: { rows: 2, cols: 2 },
      feeds: [
        {
          source: { type: 'participant', position: 1 },
          media: { audio: true, video: true },
          displayRegion: { rows: 0, cols: 0 },
        },
        {
          source: { type: 'self' },
          media: { audio: false, video: true },
          displayRegion: { rows: 1, cols: 0 },
        },
        {
          source: { type: 'participant', position: 2 },
          media: { audio: true, video: true },
          displayRegion: { rows: 0, cols: 1 },
        },
      ],
    },
  },
};

/**
 * Picture-in-Picture Layout - 4x4 grid with overlapping tiles
 * Player 0's view:
 * - Player 1: large tile spanning rows 0-1, cols 0-3 (zOrder 5)
 * - Self: small tile in bottom-right corner (rows 3, cols 3, zOrder 10)
 * - Player 2: audio-only tile spanning rows 2-3, cols 0-3
 */
export const pictureInPicture = {
  ...baseThreePlayers,
  layout: {
    0: {
      grid: { rows: 4, cols: 4 },
      feeds: [
        {
          source: { type: 'participant', position: 1 },
          media: { audio: true, video: true },
          displayRegion: {
            rows: { first: 0, last: 1 },
            cols: { first: 0, last: 3 },
          },
          zOrder: 5,
        },
        {
          source: { type: 'self' },
          media: { audio: false, video: true },
          displayRegion: { rows: 3, cols: 3 },
          zOrder: 10,
        },
        {
          source: { type: 'participant', position: 2 },
          media: { audio: true, video: false }, // Audio only, no video
          displayRegion: {
            rows: { first: 2, last: 3 },
            cols: { first: 0, last: 3 },
          },
        },
      ],
    },
  },
};

/**
 * Telephone Game Layout - Asymmetric layouts per player
 * Player 0 sees only Player 1
 * Player 1 would see only Player 2
 * Player 2 would see only Player 0
 */
export const telephoneGame = {
  ...baseThreePlayers,
  layout: {
    0: {
      grid: { rows: 1, cols: 1 },
      feeds: [
        {
          source: { type: 'participant', position: 1 },
          media: { audio: true, video: true },
          displayRegion: { rows: 0, cols: 0 },
        },
      ],
    },
    1: {
      grid: { rows: 1, cols: 1 },
      feeds: [
        {
          source: { type: 'participant', position: 2 },
          media: { audio: true, video: true },
          displayRegion: { rows: 0, cols: 0 },
        },
      ],
    },
    2: {
      grid: { rows: 1, cols: 1 },
      feeds: [
        {
          source: { type: 'participant', position: 0 },
          media: { audio: true, video: true },
          displayRegion: { rows: 0, cols: 0 },
        },
      ],
    },
  },
};

/**
 * Breakout Rooms - Players split into separate rooms
 * Room 1: Player 0 and Player 1
 * Room 2: Player 2 (alone)
 */
export const breakoutRooms = {
  ...baseThreePlayers,
  rooms: [
    { includePositions: [0, 1] },
    { includePositions: [2] },
  ],
};

/**
 * Hide Self View - Player doesn't see their own tile
 */
export const hideSelfView = {
  ...baseThreePlayers,
  // showSelfView prop will be passed to component, not in hooksConfig
};
