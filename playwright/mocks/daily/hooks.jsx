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

export function useDaily() {
  const ctx = useContext(MockDailyContext);
  if (!ctx) {
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

export function useLocalSessionId() {
  const ctx = useContext(MockDailyContext);
  return ctx?.localSessionId || null;
}

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

export function useParticipantIds(options = {}) {
  const ctx = useContext(MockDailyContext);
  if (!ctx) return [];

  const { participantIds, localSessionId } = ctx;

  if (options.filter === 'remote') {
    return participantIds.filter(id => id !== localSessionId);
  }

  return participantIds;
}

export function useVideoTrack(sessionId) {
  const ctx = useContext(MockDailyContext);
  return ctx?.videoTracks?.[sessionId] || null;
}

export function useAudioTrack(sessionId) {
  const ctx = useContext(MockDailyContext);
  return ctx?.audioTracks?.[sessionId] || null;
}

export function useParticipantProperty(sessionId, property) {
  const ctx = useContext(MockDailyContext);
  return ctx?.participants?.[sessionId]?.[property] || null;
}

export function useDailyEvent(eventName, handler) {
  // No-op in mocked tests
}

export function useAudioLevelObserver(sessionId, callback) {
  // No-op in mocked tests
}

// --------------- Components ---------------

export function DailyAudio({ onPlayFailed }) {
  return null;
}

export function DailyVideo({
  sessionId,
  type = 'video',
  automirror,
  className,
  ...props
}) {
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

export function DailyProvider({ callObject, children }) {
  return <>{children}</>;
}
