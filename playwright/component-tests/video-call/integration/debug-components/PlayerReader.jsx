/**
 * Debug component that reads player state via usePlayer() hook
 */
import React, { useEffect } from 'react';
import { usePlayer } from '../../../../mocks/empirica-hooks';

export function PlayerReader() {
  const player = usePlayer();
  const dailyId = player?.get('dailyId');
  const position = player?.get('position');

  useEffect(() => {
    // Update window every render
    window.playerReaderState = {
      playerId: player?.id,
      dailyId,
      position,
      timestamp: Date.now(),
      renderCount: (window.playerReaderState?.renderCount || 0) + 1,
    };
    console.log('[PlayerReader] Rendered with:', window.playerReaderState);
  }, [player, dailyId, position]);

  return (
    <div data-test="playerReader">
      <div data-test="playerId">{player?.id || 'null'}</div>
      <div data-test="dailyId">{dailyId || 'null'}</div>
      <div data-test="position">{position || 'null'}</div>
    </div>
  );
}
