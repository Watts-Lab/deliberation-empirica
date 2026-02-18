import React, { useEffect, useState } from 'react';
import {
  useDaily,
  useLocalSessionId,
  useVideoTrack,
  useAudioTrack,
  useParticipantProperty,
} from '@daily-co/daily-react';

/**
 * Test component that logs Daily hook values over time.
 * Used to investigate hook behavior in the test environment.
 */
export function HookMonitor({ sessionId }) {
  const callObject = useDaily();
  const localSessionId = useLocalSessionId();
  const videoTrack = useVideoTrack(sessionId || localSessionId);
  const audioTrack = useAudioTrack(sessionId || localSessionId);
  const userName = useParticipantProperty(sessionId || localSessionId, 'user_name');

  const [snapshots, setSnapshots] = useState([]);

  useEffect(() => {
    // Take snapshots at different time intervals
    const intervals = [0, 500, 1000, 2000, 3000, 5000];
    const timeouts = [];

    intervals.forEach((delay) => {
      const timeout = setTimeout(() => {
        const snapshot = {
          timestamp: Date.now(),
          delay,
          // Hook values
          localSessionId,
          videoTrack: videoTrack
            ? {
                state: videoTrack.state,
                isOff: videoTrack.isOff,
                subscribed: videoTrack.subscribed,
                persistentTrack: videoTrack.persistentTrack,
                track: videoTrack.track ? 'exists' : null,
              }
            : null,
          audioTrack: audioTrack
            ? {
                state: audioTrack.state,
                isOff: audioTrack.isOff,
                subscribed: audioTrack.subscribed,
                persistentTrack: audioTrack.persistentTrack,
                track: audioTrack.track ? 'exists' : null,
              }
            : null,
          userName,
          // Direct Daily API values (for comparison)
          callObjectExists: !!callObject,
          meetingState: callObject?.meetingState(),
          participants: callObject?.participants
            ? Object.keys(callObject.participants())
            : [],
          localParticipant: callObject?.participants?.()?.local
            ? {
                session_id: callObject.participants().local.session_id,
                user_name: callObject.participants().local.user_name,
                videoState: callObject.participants().local.tracks?.video?.state,
                audioState: callObject.participants().local.tracks?.audio?.state,
              }
            : null,
        };

        console.log(`[HookMonitor @${delay}ms]`, JSON.stringify(snapshot, null, 2));
        setSnapshots((prev) => [...prev, snapshot]);

        // Also expose on window for test access
        if (typeof window !== 'undefined') {
          if (!window.dailyHookSnapshots) {
            window.dailyHookSnapshots = [];
          }
          window.dailyHookSnapshots.push(snapshot);
        }
      }, delay);

      timeouts.push(timeout);
    });

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [callObject, localSessionId, videoTrack, audioTrack, userName, sessionId]);

  return (
    <div data-test="hookMonitor" style={{ padding: '20px', color: 'white' }}>
      <h2>Daily Hooks Monitor</h2>
      <div>Snapshots taken: {snapshots.length}</div>
      <div>
        Current useLocalSessionId: {localSessionId || 'null'}
      </div>
      <div>
        Current userName: {userName || 'null'}
      </div>
    </div>
  );
}
