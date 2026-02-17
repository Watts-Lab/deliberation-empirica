import React, { createContext, useState, useEffect, useRef } from 'react';

/**
 * Mock Daily.co Context for component tests
 *
 * Provides mocked Daily.co state that the aliased Daily hooks read from.
 * Use this for tests that need to control video/audio track states
 * without actually connecting to Daily.co.
 *
 * ## Test-Accessible Globals (exposed on window)
 *
 * ### window.mockCallObject
 * The mock call object with a real EventEmitter. Use to fire Daily events:
 *   await page.evaluate(() => window.mockCallObject.emit('participant-joined', {
 *     participant: { session_id: 'daily-p1', tracks: {} }
 *   }));
 * Track updateParticipants calls:
 *   const calls = await page.evaluate(() => window.mockCallObject._updateParticipantsCalls);
 *
 * ### window.mockDailySetLocalSessionId(id)
 * Update the local session ID mid-test to simulate reconnection:
 *   await page.evaluate(() => window.mockDailySetLocalSessionId('daily-p0-v2'));
 *
 * ### window.mockDailyDeviceOverrides
 * Override device functions BEFORE mount to test error scenarios:
 *   await page.evaluate(() => {
 *     window.mockDailyDeviceOverrides = {
 *       setSpeaker: () => Promise.reject(new DOMException('NotAllowedError', 'NotAllowedError')),
 *     };
 *   });
 * The device functions read this at call-time, so overrides work even after mount.
 */
export const MockDailyContext = createContext(null);

/**
 * Minimal EventEmitter for MockCallObject.
 * Supports on/off/emit — same interface as Daily's call object.
 */
class MockEventEmitter {
  constructor() {
    this._handlers = {};
  }

  on(event, handler) {
    if (!this._handlers[event]) this._handlers[event] = [];
    this._handlers[event].push(handler);
  }

  off(event, handler) {
    if (!this._handlers[event]) return;
    this._handlers[event] = this._handlers[event].filter(h => h !== handler);
  }

  emit(event, data) {
    const handlers = this._handlers[event] || [];
    handlers.forEach(h => h(data));
  }
}

/**
 * Mock call object — a proper EventEmitter with spy tracking.
 *
 * Exposed on window.mockCallObject so tests can:
 *   - Fire Daily events:  window.mockCallObject.emit('joined-meeting', {})
 *   - Inspect calls:      window.mockCallObject._updateParticipantsCalls
 *   - Control state:      window.mockCallObject._meetingState = 'left-meeting'
 */
class MockCallObject extends MockEventEmitter {
  constructor() {
    super();
    this._meetingState = 'joined-meeting';
    this._updateParticipantsCalls = [];
    this._participants = {};
    this._audioEnabled = true;  // false = mic muted; tests can set via _audioEnabled
    this._videoEnabled = true;  // false = camera muted; tests can set via _videoEnabled
  }

  meetingState() { return this._meetingState; }
  isDestroyed() { return false; }
  join() { return Promise.resolve(); }
  leave() { return Promise.resolve(); }
  setUserName() {}
  setInputDevicesAsync() { return Promise.resolve(); }
  setSubscribeToTracksAutomatically() {}

  updateParticipants(updates) {
    this._updateParticipantsCalls.push({ updates, timestamp: Date.now() });
  }

  participants() { return this._participants; }
  getNetworkStats() { return Promise.resolve({}); }
  getInputDevices() { return { mic: { deviceId: 'default-mic', label: 'Default Microphone' }, camera: { deviceId: 'default-cam', label: 'Default Camera' } }; }
  getOutputDevices() { return { speaker: { deviceId: 'default-speaker', label: 'Default Speaker' } }; }

  // Local media state — avRecovery reads these to detect muted mic/camera
  async localAudio() { return { enabled: this._audioEnabled, muted: false, readyState: 'live' }; }
  async localVideo() { return { enabled: this._videoEnabled, muted: false, readyState: 'live' }; }

  // Soft-fix actions — avRecovery calls these to unmute mic/camera
  async setLocalAudio(enabled) { this._audioEnabled = enabled; }
  async setLocalVideo(enabled) { this._videoEnabled = enabled; }
}

export function MockDailyProvider({
  localSessionId: initialLocalSessionId = null,
  participantIds = [],
  videoTracks = {},
  audioTracks = {},
  participants = {},
  callObject = null,
  devices = null,
  children,
}) {
  // Allow tests to update localSessionId mid-test via window.mockDailySetLocalSessionId.
  // This enables HISTORY-004: testing that a new history entry is logged when the
  // Daily session ID changes (e.g., participant rejoins after network drop).
  const [localSessionId, setLocalSessionId] = useState(initialLocalSessionId);

  // Stable MockCallObject instance — created once, exposed on window.
  // Tests can fire events and inspect calls via window.mockCallObject.
  const mockCallObjectRef = useRef(null);
  if (!mockCallObjectRef.current) {
    mockCallObjectRef.current = new MockCallObject();
  }

  useEffect(() => {
    window.mockDailySetLocalSessionId = setLocalSessionId;
    window.mockCallObject = mockCallObjectRef.current;
    return () => {
      delete window.mockDailySetLocalSessionId;
      delete window.mockCallObject;
    };
  }, []);

  // Device functions read window.mockDailyDeviceOverrides at call-time, allowing
  // tests to set up overrides via page.evaluate() before (or even after) mount.
  // Pattern: set window.mockDailyDeviceOverrides = { setSpeaker: () => Promise.reject(...) }
  // before mounting to simulate device errors like NotAllowedError.
  const defaultDevices = {
    cameras: [],
    microphones: [],
    speakers: [],
    currentCam: null,
    currentMic: null,
    currentSpeaker: null,
    setSpeaker: (id) => (window.mockDailyDeviceOverrides?.setSpeaker || (() => Promise.resolve()))(id),
    setCamera: (id) => (window.mockDailyDeviceOverrides?.setCamera || (() => Promise.resolve()))(id),
    setMicrophone: (id) => (window.mockDailyDeviceOverrides?.setMicrophone || (() => Promise.resolve()))(id),
  };

  // Merge provided device data with default functions so tests can pass
  // data-only devices (without functions) via serializable hooksConfig.
  // The function properties from defaultDevices are preserved even when devices prop
  // is provided, since JSON serialization strips functions from hooksConfig.
  const mergedDevices = devices
    ? { ...defaultDevices, ...devices, setSpeaker: defaultDevices.setSpeaker, setCamera: defaultDevices.setCamera, setMicrophone: defaultDevices.setMicrophone }
    : defaultDevices;

  const contextValue = {
    localSessionId,
    participantIds,
    videoTracks,
    audioTracks,
    participants,
    callObject: callObject || mockCallObjectRef.current,
    devices: mergedDevices,
  };

  return (
    <MockDailyContext.Provider value={contextValue}>
      {children}
    </MockDailyContext.Provider>
  );
}
