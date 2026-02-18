/**
 * Debug component that tracks whether player object identity changes across renders
 */
import React, { useEffect, useRef } from 'react';
import { usePlayer } from '../../../../mocks/empirica-hooks';

export function PlayerIdentityTracker() {
  const player = usePlayer();
  const previousPlayerRef = useRef(null);
  const renderCountRef = useRef(0);

  // Get dailyId in render body so it can be a useEffect dependency
  const dailyId = player?.get?.('dailyId');

  useEffect(() => {
    renderCountRef.current += 1;

    const isSameInstance = previousPlayerRef.current === player;

    window.playerIdentityTracking = window.playerIdentityTracking || [];
    window.playerIdentityTracking.push({
      renderCount: renderCountRef.current,
      playerId: player?.id,
      playerInstance: player,
      isSameInstanceAsPrevious: previousPlayerRef.current === null ? 'first-render' : isSameInstance,
      dailyId,
      timestamp: Date.now(),
    });

    console.log('[PlayerIdentityTracker] Render #' + renderCountRef.current, {
      isSameInstance: previousPlayerRef.current === null ? 'first-render' : isSameInstance,
      dailyId,
    });

    previousPlayerRef.current = player;
  }, [player, dailyId]);  // Add dailyId as dependency

  return (
    <div data-test="playerIdentityTracker">
      Render #{renderCountRef.current}
    </div>
  );
}
