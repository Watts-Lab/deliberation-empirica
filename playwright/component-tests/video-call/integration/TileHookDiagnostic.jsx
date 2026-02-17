import React, { useEffect } from 'react';
import { useVideoTrack, useAudioTrack, useParticipantProperty } from '@daily-co/daily-react';
import { usePlayer } from '@empirica/core/player/classic/react';

/**
 * Diagnostic component that mimics Tile's hook usage
 * and exposes values to window for test inspection.
 *
 * This helps us understand what Daily hooks return when called
 * inside the MockEmpiricaProvider → VideoCall → Call component tree.
 */
export function TileHookDiagnostic() {
  const player = usePlayer();
  const dailyId = player?.get('dailyId');

  // DEBUG: Check if we're getting the same player instance as window context
  if (typeof window !== 'undefined' && window.mockEmpiricaContext) {
    const contextPlayer = window.mockEmpiricaContext.players[0];
    const sameInstance = player === contextPlayer;
    const hookDailyId = player?.get('dailyId');
    const contextDailyId = contextPlayer?.get('dailyId');

    // Store comparison for test inspection
    window.playerInstanceComparison = {
      sameInstance,
      hookPlayerId: player?.id,
      contextPlayerId: contextPlayer?.id,
      hookDailyId,
      contextDailyId,
      mismatch: !sameInstance || hookDailyId !== contextDailyId,
      // Check set call history to see if dailyId was ever set
      setCallHistory: player?.getAllSetCalls ? player.getAllSetCalls() : null,
    };

    // Always log once (not in the interval)
    if (!window._loggedInstanceComparison) {
      console.log('[TileHookDiagnostic] Player instance comparison:', window.playerInstanceComparison);
      window._loggedInstanceComparison = true;
    }
  }

  const videoState = useVideoTrack(dailyId);
  const audioState = useAudioTrack(dailyId);
  const username = useParticipantProperty(dailyId, 'user_name');

  useEffect(() => {
    // Continuously update hook values to window for test inspection
    const updateDiagnostic = () => {
      window.tileHookDiagnostic = {
        dailyId,
        videoState: videoState ? {
          state: videoState.state,
          isOff: videoState.isOff,
          subscribed: videoState.subscribed,
          persistentTrack: !!videoState.persistentTrack,
          track: !!videoState.track,
        } : null,
        audioState: audioState ? {
          state: audioState.state,
          isOff: audioState.isOff,
          subscribed: audioState.subscribed,
          persistentTrack: !!audioState.persistentTrack,
          track: !!audioState.track,
        } : null,
        username,

        // Computed flags (same as Tile logic)
        isVideoConnected: !!videoState,
        isVideoSubscribed: true, // For local tiles
        isVideoMuted: videoState?.isOff,
        isAudioConnected: !!audioState,
        isAudioSubscribed: true, // For local tiles
        isAudioMuted: audioState?.isOff,

        timestamp: Date.now(),
        updateCount: (window.tileHookDiagnostic?.updateCount || 0) + 1,
      };

      console.log('[TileHookDiagnostic] Update #' + window.tileHookDiagnostic.updateCount + ':', {
        dailyId: window.tileHookDiagnostic.dailyId,
        videoState: window.tileHookDiagnostic.videoState?.state,
        isVideoMuted: window.tileHookDiagnostic.isVideoMuted,
      });
    };

    // Update immediately
    updateDiagnostic();

    // Also update every 500ms to catch changes
    const interval = setInterval(updateDiagnostic, 500);

    return () => clearInterval(interval);
  }, [dailyId, videoState, audioState, username]);

  return (
    <div data-test="tileHookDiagnostic" style={{ padding: '8px', backgroundColor: '#333', color: '#fff', fontSize: '10px' }}>
      <div>Daily ID: {dailyId || 'null'}</div>
      <div>Video State: {videoState ? 'present' : 'null'}</div>
      <div>Audio State: {audioState ? 'present' : 'null'}</div>
      <div>Username: {username || 'null'}</div>
    </div>
  );
}
