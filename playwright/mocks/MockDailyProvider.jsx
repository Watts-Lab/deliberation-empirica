import React, { createContext } from 'react';

/**
 * Mock Daily.co Context for component tests
 *
 * Provides mocked Daily.co state that the aliased Daily hooks read from.
 * Use this for tests that need to control video/audio track states
 * without actually connecting to Daily.co.
 */
export const MockDailyContext = createContext(null);

/**
 * Mock Daily.co Provider for component tests
 *
 * Wraps components and provides mock Daily.co state via context.
 * The aliased Daily hooks (useDaily, useLocalSessionId, etc.) read from this.
 *
 * For tests that need REAL Daily.co WebRTC:
 *   Use the real DailyProvider from '@daily-co/daily-react' instead.
 *
 * @param {Object} props
 * @param {string|null} props.localSessionId - The local participant's Daily session ID
 * @param {Array<string>} props.participantIds - All participant session IDs
 * @param {Object} props.videoTracks - Map of sessionId to video track state
 * @param {Object} props.audioTracks - Map of sessionId to audio track state
 * @param {Object|null} props.callObject - Mock call object (for useDaily)
 * @param {Object|null} props.devices - Mock devices state (for useDevices)
 * @param {React.ReactNode} props.children
 *
 * @example
 * // Basic test with video showing
 * <MockDailyProvider
 *   localSessionId="daily-123"
 *   participantIds={['daily-123']}
 *   videoTracks={{ 'daily-123': { isOff: false, subscribed: true } }}
 *   audioTracks={{ 'daily-123': { isOff: false, subscribed: true } }}
 * >
 *   <VideoCall />
 * </MockDailyProvider>
 *
 * @example
 * // Test muted video state
 * <MockDailyProvider
 *   localSessionId="daily-123"
 *   participantIds={['daily-123']}
 *   videoTracks={{ 'daily-123': { isOff: true } }}
 *   audioTracks={{ 'daily-123': { isOff: false } }}
 * >
 *   <VideoCall />
 * </MockDailyProvider>
 *
 * @example
 * // Multi-participant test
 * <MockDailyProvider
 *   localSessionId="daily-local"
 *   participantIds={['daily-local', 'daily-remote-1', 'daily-remote-2']}
 *   videoTracks={{
 *     'daily-local': { isOff: false },
 *     'daily-remote-1': { isOff: false, subscribed: true },
 *     'daily-remote-2': { isOff: true, subscribed: true },
 *   }}
 *   audioTracks={{
 *     'daily-local': { isOff: false },
 *     'daily-remote-1': { isOff: false, subscribed: true },
 *     'daily-remote-2': { isOff: false, subscribed: true },
 *   }}
 * >
 *   <VideoCall />
 * </MockDailyProvider>
 */
export function MockDailyProvider({
  localSessionId = null,
  participantIds = [],
  videoTracks = {},
  audioTracks = {},
  callObject = null,
  devices = null,
  children,
}) {
  // Create default devices if not provided
  const defaultDevices = {
    cameras: [],
    microphones: [],
    speakers: [],
    currentCam: null,
    currentMic: null,
    currentSpeaker: null,
    setSpeaker: () => Promise.resolve(),
    setCamera: () => Promise.resolve(),
    setMicrophone: () => Promise.resolve(),
  };

  // Create default mock call object if not provided
  const defaultCallObject = {
    meetingState: () => 'joined-meeting',
    isDestroyed: () => false,
    join: () => Promise.resolve(),
    leave: () => Promise.resolve(),
    setUserName: () => {},
    setInputDevicesAsync: () => Promise.resolve(),
    setSubscribeToTracksAutomatically: () => {},
    updateParticipants: () => {},
    participants: () => ({}),
    getNetworkStats: () => Promise.resolve({}),
    on: () => {},
    off: () => {},
  };

  const contextValue = {
    localSessionId,
    participantIds,
    videoTracks,
    audioTracks,
    callObject: callObject || defaultCallObject,
    devices: devices || defaultDevices,
  };

  return (
    <MockDailyContext.Provider value={contextValue}>
      {children}
    </MockDailyContext.Provider>
  );
}
