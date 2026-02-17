/**
 * Mock Daily.co Hooks for component tests
 *
 * This module is aliased to replace '@daily-co/daily-react'
 * in the Playwright component test Vite config.
 *
 * For MOCKED tests: hooks read from MockDailyContext (via MockDailyProvider)
 * For REAL Daily tests: use the actual DailyProvider and don't alias this module
 */

import React, { useContext } from 'react';
import { MockDailyContext } from './MockDailyProvider.jsx';

/**
 * Get the Daily call object
 *
 * @returns {Object|null} Daily call object or mock
 */
export function useDaily() {
  const ctx = useContext(MockDailyContext);
  if (!ctx) {
    // If no MockDailyProvider, return a minimal mock
    return {
      meetingState: () => 'new',
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
  }
  return ctx.callObject;
}

/**
 * Get the local participant's session ID
 *
 * @returns {string|null} Local session ID
 */
export function useLocalSessionId() {
  const ctx = useContext(MockDailyContext);
  return ctx?.localSessionId || null;
}

/**
 * Get the current devices state
 *
 * @returns {Object} Devices state with cameras, microphones, speakers
 */
export function useDevices() {
  const ctx = useContext(MockDailyContext);
  return ctx?.devices || {
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
}

/**
 * Get participant IDs with optional filter
 *
 * @param {Object} options
 * @param {string} options.filter - 'remote' to exclude local participant
 * @returns {Array<string>} Participant session IDs
 */
export function useParticipantIds(options = {}) {
  const ctx = useContext(MockDailyContext);
  if (!ctx) return [];

  const { participantIds, localSessionId } = ctx;

  if (options.filter === 'remote') {
    return participantIds.filter(id => id !== localSessionId);
  }

  return participantIds;
}

/**
 * Get video track state for a participant
 *
 * @param {string} sessionId - Participant session ID
 * @returns {Object|null} Video track state
 */
export function useVideoTrack(sessionId) {
  const ctx = useContext(MockDailyContext);
  return ctx?.videoTracks?.[sessionId] || null;
}

/**
 * Get audio track state for a participant
 *
 * @param {string} sessionId - Participant session ID
 * @returns {Object|null} Audio track state
 */
export function useAudioTrack(sessionId) {
  const ctx = useContext(MockDailyContext);
  return ctx?.audioTracks?.[sessionId] || null;
}

/**
 * Get a property from a participant
 *
 * @param {string} sessionId - Participant session ID
 * @param {string} property - Property name (e.g., 'user_name')
 * @returns {any} Property value
 */
export function useParticipantProperty(sessionId, property) {
  const ctx = useContext(MockDailyContext);
  return ctx?.participants?.[sessionId]?.[property] || null;
}

/**
 * Subscribe to Daily events
 *
 * In mocked tests, this is a no-op. The test controls state via props.
 *
 * @param {string} eventName - Event name to subscribe to
 * @param {Function} handler - Event handler
 */
export function useDailyEvent(eventName, handler) {
  // No-op in mocked tests
  // For real Daily tests, use the actual DailyProvider
}

/**
 * Audio level observer hook
 *
 * @param {string} sessionId - Participant session ID
 * @param {Function} callback - Callback receiving audio level
 */
export function useAudioLevelObserver(sessionId, callback) {
  // No-op in mocked tests
}

// --------------- Components ---------------

/**
 * DailyAudio component - renders audio elements
 *
 * In mocked tests, this renders nothing.
 *
 * @param {Object} props
 * @param {Function} props.onPlayFailed - Callback when audio play fails
 */
export function DailyAudio({ onPlayFailed }) {
  // Render nothing in mocked tests
  return null;
}

/**
 * DailyVideo component - renders video element
 *
 * In mocked tests, this renders a placeholder div.
 *
 * @param {Object} props
 * @param {string} props.sessionId - Participant session ID
 * @param {string} props.type - Video type ('video' or 'screenVideo')
 * @param {boolean} props.automirror - Whether to mirror local video
 * @param {string} props.className - CSS class name
 */
export function DailyVideo({
  sessionId,
  type = 'video',
  automirror,
  className,
  ...props
}) {
  // Only mirror if automirror is true AND this is the local participant
  const ctx = useContext(MockDailyContext);
  const isLocal = ctx?.localSessionId === sessionId;
  const shouldMirror = automirror && isLocal;

  return (
    <div
      data-testid="mock-daily-video"
      data-session-id={sessionId}
      data-type={type}
      data-automirror={automirror}
      data-is-local={isLocal}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#1a1a2e',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#666',
        fontSize: '11px',
        gap: '4px',
      }}
      {...props}
    >
      <div>Mock Video</div>
      <div style={{ fontSize: '10px', color: '#555' }}>
        session: {sessionId?.slice(0, 8)}
        {shouldMirror && ' • mirrored'}
        {type !== 'video' && ` • ${type}`}
      </div>
    </div>
  );
}

/**
 * DailyProvider component - provides Daily context
 *
 * In this mock module, this just passes through children.
 * The real Daily provider is used separately when needed.
 *
 * @param {Object} props
 * @param {Object} props.callObject - Daily call object
 * @param {React.ReactNode} props.children
 */
export function DailyProvider({ callObject, children }) {
  // For mock mode, just pass through children
  // The MockDailyProvider handles the context
  return <>{children}</>;
}
