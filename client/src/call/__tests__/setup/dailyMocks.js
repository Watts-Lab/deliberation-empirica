/**
 * Mock utilities for @daily-co/daily-react
 *
 * These mocks allow testing call logic without real WebRTC connections.
 * Update these when Daily.co's API changes.
 */

import { vi } from 'vitest';

/**
 * Creates a mock Daily call object with common methods
 */
export function createMockCallObject(overrides = {}) {
  return {
    join: vi.fn().mockResolvedValue(undefined),
    leave: vi.fn(),
    setInputDevicesAsync: vi.fn().mockResolvedValue(undefined),
    setOutputDeviceAsync: vi.fn().mockResolvedValue(undefined),
    setUserName: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    meetingState: vi.fn(() => 'joined-meeting'),
    participants: vi.fn(() => ({})),
    updateParticipants: vi.fn(),
    isDestroyed: vi.fn(() => false),
    cameraState: vi.fn(() => ({ camera: 'started' })),
    setSubscribeToTracksAutomatically: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates mock device objects matching Daily.co's shape
 */
export function createMockDevices(overrides = {}) {
  const defaultDevices = {
    cameras: [
      { device: { deviceId: 'camera-1', label: 'FaceTime HD Camera', kind: 'videoinput' } },
      { device: { deviceId: 'camera-2', label: 'External Webcam', kind: 'videoinput' } },
    ],
    microphones: [
      { device: { deviceId: 'mic-1', label: 'Built-in Microphone', kind: 'audioinput' } },
      { device: { deviceId: 'mic-2', label: 'External Microphone', kind: 'audioinput' } },
    ],
    speakers: [
      { device: { deviceId: 'speaker-1', label: 'Built-in Speakers', kind: 'audiooutput' } },
      { device: { deviceId: 'speaker-2', label: 'Headphones', kind: 'audiooutput' } },
    ],
    currentCam: { device: { deviceId: 'camera-1', label: 'FaceTime HD Camera' } },
    currentMic: { device: { deviceId: 'mic-1', label: 'Built-in Microphone' } },
    currentSpeaker: { device: { deviceId: 'speaker-1', label: 'Built-in Speakers' } },
    setSpeaker: vi.fn().mockResolvedValue(undefined),
  };

  return {
    ...defaultDevices,
    ...overrides,
  };
}

/**
 * Creates a mock participant object matching Daily.co's shape
 */
export function createMockParticipant(overrides = {}) {
  return {
    session_id: 'test-session-id',
    user_name: 'Test User',
    joined_at: new Date().toISOString(),
    local: false,
    tracks: {
      audio: {
        state: 'playable',
        subscribed: true,
        blocked: false,
      },
      video: {
        state: 'playable',
        subscribed: true,
        blocked: false,
      },
      screenVideo: {
        state: 'off',
        subscribed: false,
        blocked: false,
      },
    },
    ...overrides,
  };
}

/**
 * Mock hook factory - use in vitest.setup.js or test files
 */
export function setupDailyMocks() {
  const mockCallObject = createMockCallObject();
  const mockDevices = createMockDevices();

  vi.mock('@daily-co/daily-react', () => ({
    DailyProvider: ({ children }) => children,
    DailyAudio: () => null,

    useDaily: vi.fn(() => mockCallObject),
    useDevices: vi.fn(() => mockDevices),
    useParticipantIds: vi.fn(() => []),
    useLocalSessionId: vi.fn(() => 'local-session-id'),
    useDailyEvent: vi.fn(),
  }));

  return { mockCallObject, mockDevices };
}

/**
 * Helper to simulate Daily.co events in tests
 */
export function simulateDailyEvent(mockCallObject, eventName, eventData) {
  const handlers = mockCallObject.on.mock.calls
    .filter(([name]) => name === eventName)
    .map(([, handler]) => handler);

  handlers.forEach(handler => handler(eventData));
}

/**
 * Helper to simulate device changes (e.g., Safari ID rotation)
 */
export function simulateDeviceChange(mockDevices, newDevices) {
  Object.assign(mockDevices, newDevices);
}
