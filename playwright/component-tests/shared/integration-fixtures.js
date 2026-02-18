/**
 * Integration Test Fixtures
 *
 * Fixtures for tests using REAL Daily.co WebRTC connections.
 * These use the hooksConfig pattern with plain serializable objects.
 *
 * Key difference from mocked fixtures:
 * - daily.roomUrl (string) → creates DailyTestWrapper with real Daily.co
 * - No mock call states - Daily provides real connection state
 *
 * Usage:
 *   const room = await createTestRoom();
 *   const config = {
 *     ...singlePlayerRealDaily,
 *     empirica: {
 *       ...singlePlayerRealDaily.empirica,
 *       game: { attrs: { dailyUrl: room.url } }
 *     },
 *     daily: { roomUrl: room.url }
 *   };
 *   await mount(<VideoCall />, { hooksConfig: config });
 */

/**
 * Single player with real Daily.co connection
 * Base fixture - replace ROOM_URL_PLACEHOLDER with actual room URL
 */
export const singlePlayerRealDaily = {
  empirica: {
    currentPlayerId: 'p0',
    players: [
      {
        id: 'p0',
        attrs: {
          name: 'Test Player',
          position: '0',
        },
      },
    ],
    game: {
      attrs: {
        dailyUrl: 'ROOM_URL_PLACEHOLDER', // Replace in test
      },
    },
    stage: {
      attrs: {},
    },
  },
  daily: {
    roomUrl: 'ROOM_URL_PLACEHOLDER', // Replace in test
    autoJoin: false, // Let VideoCall handle the join (it reads dailyUrl from game)
  },
};

/**
 * Single player with custom speaker device
 * For testing device selection persistence
 */
export const singlePlayerWithCustomSpeaker = {
  empirica: {
    currentPlayerId: 'p0',
    players: [
      {
        id: 'p0',
        attrs: {
          name: 'Test Player',
          position: '0',
          speakerId: 'external-speakers',
          speakerLabel: 'External Speakers',
        },
      },
    ],
    game: {
      attrs: {
        dailyUrl: 'ROOM_URL_PLACEHOLDER',
      },
    },
    stage: {
      attrs: {},
    },
  },
  daily: {
    roomUrl: 'ROOM_URL_PLACEHOLDER',
  },
};

/**
 * Single player with custom camera/mic devices
 * For testing device switching scenarios
 */
export const singlePlayerWithCustomDevices = {
  empirica: {
    currentPlayerId: 'p0',
    players: [
      {
        id: 'p0',
        attrs: {
          name: 'Test Player',
          position: '0',
          camId: 'front-camera',
          camLabel: 'Front Camera',
          micId: 'headset-mic',
          micLabel: 'Headset Microphone',
        },
      },
    ],
    game: {
      attrs: {
        dailyUrl: 'ROOM_URL_PLACEHOLDER',
      },
    },
    stage: {
      attrs: {},
    },
  },
  daily: {
    roomUrl: 'ROOM_URL_PLACEHOLDER',
  },
};

/**
 * Helper to replace ROOM_URL_PLACEHOLDER with actual room URL
 *
 * @param {Object} fixture - Base fixture
 * @param {string} roomUrl - Actual Daily room URL
 * @returns {Object} Fixture with room URL injected
 */
export function withRoomUrl(fixture, roomUrl) {
  return {
    ...fixture,
    empirica: {
      ...fixture.empirica,
      game: {
        ...fixture.empirica.game,
        attrs: {
          ...fixture.empirica.game.attrs,
          dailyUrl: roomUrl,
        },
      },
    },
    daily: {
      ...fixture.daily,
      roomUrl,
    },
  };
}
