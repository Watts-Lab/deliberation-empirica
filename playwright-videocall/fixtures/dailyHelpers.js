/**
 * Helper utilities for managing Daily.co test rooms
 */

const DAILY_API_BASE = 'https://api.daily.co/v1';

/**
 * Creates a temporary Daily.co room for testing
 *
 * @param {string} name - Optional room name (defaults to test-{timestamp})
 * @returns {Promise<{url: string, name: string}>}
 */
export async function createTestRoom(name = `test-${Date.now()}`) {
  const apiKey = process.env.DAILY_APIKEY;

  if (!apiKey) {
    throw new Error('DAILY_APIKEY environment variable is required');
  }

  const response = await fetch(`${DAILY_API_BASE}/rooms`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      properties: {
        enable_people_ui: false,
        enable_screenshare: false,
        enable_prejoin_ui: false,
        // Room expires in 1 hour
        exp: Math.floor(Date.now() / 1000) + 3600,
        // Disable recording for test rooms
        enable_recording: false,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create test room: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return {
    url: data.url,
    name: data.name,
  };
}

/**
 * Deletes a Daily.co room
 *
 * @param {string} name - Room name to delete
 * @returns {Promise<void>}
 */
export async function deleteTestRoom(name) {
  const apiKey = process.env.DAILY_APIKEY;

  if (!apiKey) {
    throw new Error('DAILY_APIKEY environment variable is required');
  }

  const response = await fetch(`${DAILY_API_BASE}/rooms/${name}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const error = await response.json();
    console.warn(`Failed to delete test room ${name}:`, error);
  }
}

/**
 * Gets info about a Daily.co room
 *
 * @param {string} name - Room name
 * @returns {Promise<object>}
 */
export async function getRoomInfo(name) {
  const apiKey = process.env.DAILY_APIKEY;

  if (!apiKey) {
    throw new Error('DAILY_APIKEY environment variable is required');
  }

  const response = await fetch(`${DAILY_API_BASE}/rooms/${name}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to get room info: ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * Waits for a specific number of participants to join a room
 * Useful for synchronization in multi-participant tests
 *
 * @param {string} roomName - Room name to monitor
 * @param {number} expectedCount - Number of participants to wait for
 * @param {number} timeoutMs - Timeout in milliseconds (default 30s)
 * @returns {Promise<void>}
 */
export async function waitForParticipants(roomName, expectedCount, timeoutMs = 30000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const info = await getRoomInfo(roomName);

    // Daily.co doesn't directly expose participant count in room info,
    // so this is a placeholder. In practice, you'd check from within the app.
    // This function is more useful when combined with presence webhooks.

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error(`Timeout waiting for ${expectedCount} participants in room ${roomName}`);
}
