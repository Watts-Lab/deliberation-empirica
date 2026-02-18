/**
 * Daily.co room management for tests
 * Uses production server code directly
 */
import {
  createRoom,
  closeRoom,
  startRecording,
  stopRecording,
  getRoom,
} from '../../server/src/providers/dailyco.js';

// Track rooms created during tests for cleanup
const testRooms = new Set();

/**
 * Create a test room using production room creation logic
 *
 * @param {Object} options
 * @param {string} options.name - Room name (auto-generated if not provided)
 * @param {Object|string} options.videoStorage - Video storage config or 'none'
 * @returns {Promise<{url: string, name: string}>} Room details
 */
export async function createTestRoom(options = {}) {
  const roomName = options.name || `test-${Date.now()}`;
  const videoStorage = options.videoStorage || 'none';

  const room = await createRoom(roomName, videoStorage);

  // Track for cleanup
  testRooms.add(room.name);

  return room;
}

/**
 * Cleanup a test room using production cleanup logic
 *
 * @param {string} roomName - Room name to cleanup
 * @returns {Promise<Object>} Recording data
 */
export async function cleanupTestRoom(roomName) {
  const recordings = await closeRoom(roomName);
  testRooms.delete(roomName);
  return recordings;
}

/**
 * Cleanup all test rooms (for use in afterAll hooks)
 *
 * @returns {Promise<void>}
 */
export async function cleanupAllTestRooms() {
  const cleanupPromises = Array.from(testRooms).map(name => closeRoom(name));
  await Promise.all(cleanupPromises);
  testRooms.clear();
}

/**
 * Start recording using production logic
 */
export { startRecording };

/**
 * Stop recording using production logic
 */
export { stopRecording };

/**
 * Get room details using production logic
 */
export { getRoom };
