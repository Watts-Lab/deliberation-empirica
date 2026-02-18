/**
 * Debug component that calls player.set() during mount
 */
import React, { useEffect } from 'react';
import { usePlayer } from '../../../../mocks/empirica-hooks';

export function PlayerWriter() {
  const player = usePlayer();

  useEffect(() => {
    console.log('[PlayerWriter] Mounted, calling player.set()');
    player?.set('dailyId', 'test-daily-id-123');
    player?.set('position', '5');
  }, [player]);

  return <div data-test="playerWriter">Writer mounted</div>;
}
