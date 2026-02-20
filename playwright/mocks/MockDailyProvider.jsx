import React, { createContext, useMemo, useState, useEffect, useRef } from 'react';

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
 * Set participant userData for fast position mapping (issue #1187):
 *   await page.evaluate(() => {
 *     window.mockCallObject._participants = {
 *       'daily-p1': { session_id: 'daily-p1', userData: { position: 1 }, tracks: {} }
 *     };
 *   });
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
 *   - Simulate muted mic: window.mockCallObject._audioEnabled = false
 *   - Simulate ended track: window.mockCallObject._audioReadyState = 'ended'
 */
class MockCallObject extends MockEventEmitter {
  constructor() {
    super();
    this._meetingState = 'joined-meeting';
    this._updateParticipantsCalls = [];
    this._setInputDevicesCalls = []; // eslint-disable-line no-underscore-dangle
    this._participants = {};
    this._audioEnabled = true;    // false = mic muted; tests can set via _audioEnabled
    this._videoEnabled = true;    // false = camera muted; tests can set via _videoEnabled
    this._audioReadyState = 'live'; // 'ended' = track ended; tests can set via _audioReadyState
    this._videoReadyState = 'live'; // 'ended' = track ended; tests can set via _videoReadyState
    this._localUserData = null;   // userData passed in join() options
    this._localSessionId = null;  // session ID of local participant (set via setLocalSessionId)
  }

  meetingState() { return this._meetingState; }
  isDestroyed() { return false; }

  // join() accepts options including userData for immediate position mapping (issue #1187)
  // The userData is stored and returned in participants() for the local participant.
  join(options = {}) {
    if (options.userData) {
      this._localUserData = options.userData;
    }
    return Promise.resolve();
  }

  leave() { return Promise.resolve(); }
  setUserName() {}

  // Re-acquires a device track — simulates getUserMedia re-acquisition succeeding.
  // Resets readyState to 'live' for whichever device type is being re-acquired.
  setInputDevicesAsync({ audioDeviceId, videoDeviceId } = {}) {
    if (audioDeviceId !== undefined) this._audioReadyState = 'live';
    if (videoDeviceId !== undefined) this._videoReadyState = 'live';
    this._setInputDevicesCalls.push({ audioDeviceId, videoDeviceId, timestamp: Date.now() }); // eslint-disable-line no-underscore-dangle
    return Promise.resolve();
  }

  setSubscribeToTracksAutomatically() {}

  updateParticipants(updates) {
    this._updateParticipantsCalls.push({ updates, timestamp: Date.now() });
  }

  // Returns participants with userData included.
  // Tests can set _participants directly, but userData is also available
  // from join() options for the local participant.
  participants() {
    // Merge any local userData into the local participant if session ID matches
    if (this._localSessionId && this._localUserData && this._participants[this._localSessionId]) {
      const localP = this._participants[this._localSessionId];
      return {
        ...this._participants,
        [this._localSessionId]: { ...localP, userData: this._localUserData },
      };
    }
    return this._participants;
  }

  // Helper for tests to set local session ID so userData gets merged correctly
  setLocalSessionId(id) {
    this._localSessionId = id;
  }
  getNetworkStats() { return Promise.resolve({}); }
  getInputDevices() { return { mic: { deviceId: 'default-mic', label: 'Default Microphone' }, camera: { deviceId: 'default-cam', label: 'Default Camera' } }; }
  getOutputDevices() { return { speaker: { deviceId: 'default-speaker', label: 'Default Speaker' } }; }

  // Local media state — avRecovery reads these to detect muted mic/camera or ended tracks
  async localAudio() { return { enabled: this._audioEnabled, muted: false, readyState: this._audioReadyState }; }
  async localVideo() { return { enabled: this._videoEnabled, muted: false, readyState: this._videoReadyState }; }

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

  // Sync localSessionId to mock call object so participants() can merge userData correctly
  useEffect(() => {
    if (mockCallObjectRef.current) {
      mockCallObjectRef.current._localSessionId = localSessionId;
    }
  }, [localSessionId]);

  // Device functions read window.mockDailyDeviceOverrides at call-time, allowing
  // tests to set up overrides via page.evaluate() before (or even after) mount.
  // Pattern: set window.mockDailyDeviceOverrides = { setSpeaker: () => Promise.reject(...) }
  // before mounting to simulate device errors like NotAllowedError.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const defaultDevices = useMemo(() => ({
    cameras: [],
    microphones: [],
    speakers: [],
    currentCam: null,
    currentMic: null,
    currentSpeaker: null,
    // Functions read window.mockDailyDeviceOverrides at call-time, so no render deps needed.
    setSpeaker: (id) => (window.mockDailyDeviceOverrides?.setSpeaker || (() => Promise.resolve()))(id),
    setCamera: (id) => (window.mockDailyDeviceOverrides?.setCamera || (() => Promise.resolve()))(id),
    setMicrophone: (id) => (window.mockDailyDeviceOverrides?.setMicrophone || (() => Promise.resolve()))(id),
  }), []);

  // Merge provided device data with default functions so tests can pass
  // data-only devices (without functions) via serializable hooksConfig.
  // The function properties from defaultDevices are preserved even when devices prop
  // is provided, since JSON serialization strips functions from hooksConfig.
  const mergedDevices = useMemo(() => (devices
    ? { ...defaultDevices, ...devices, setSpeaker: defaultDevices.setSpeaker, setCamera: defaultDevices.setCamera, setMicrophone: defaultDevices.setMicrophone }
    : defaultDevices), [devices, defaultDevices]);

  const contextValue = useMemo(() => ({
    localSessionId,
    participantIds,
    videoTracks,
    audioTracks,
    participants,
    callObject: callObject || mockCallObjectRef.current,
    devices: mergedDevices,
  }), [
    localSessionId, participantIds, videoTracks, audioTracks,
    participants, callObject, mergedDevices,
  ]);

  return (
    <MockDailyContext.Provider value={contextValue}>
      {children}
    </MockDailyContext.Provider>
  );
}
