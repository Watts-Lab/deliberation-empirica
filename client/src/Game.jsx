import React, { useEffect, useRef } from "react";
import * as Sentry from "@sentry/react";
import {
  useGame,
  useStage,
  usePlayer,
  useRound,
} from "@empirica/core/player/classic/react";
import { Loading } from "@empirica/core/player/react";
import { Profile } from "./Profile";
import { Stage } from "./Stage";
import { Lobby } from "./intro-exit/Lobby";
import { ConfirmLeave } from "./components/ConfirmLeave";

const STALE_STATE_TIMEOUT = 5000; // 5 seconds
const RELOAD_SESSION_KEY = "gameStaleStateReload";

export function Game() {
  const game = useGame();
  const stage = useStage();
  const player = usePlayer();
  const round = useRound();
  const staleTimerRef = useRef(null);

  const assigned = player?.get("assigned");
  const gameReady = !!(game && stage && round);

  // Detect stale state: player is assigned but game hooks haven't populated.
  // This can happen if the websocket misses a stage/round update from the server.
  // Report to Sentry and reload once to recover.
  useEffect(() => {
    if (!assigned) return undefined;

    if (gameReady) {
      // State arrived — clear any pending timer and reset the reload flag
      if (staleTimerRef.current) {
        clearTimeout(staleTimerRef.current);
        staleTimerRef.current = null;
      }
      sessionStorage.removeItem(RELOAD_SESSION_KEY);
      return undefined;
    }

    // Game state is missing — start a timer if one isn't already running
    if (!staleTimerRef.current) {
      staleTimerRef.current = setTimeout(() => {
        const alreadyReloaded = sessionStorage.getItem(RELOAD_SESSION_KEY);

        Sentry.captureMessage("Game state stale: stage/round not received", {
          level: "error",
          extra: {
            hasGame: !!game,
            hasStage: !!stage,
            hasRound: !!round,
            playerId: player?.id,
            gameId: game?.id,
            alreadyReloaded: !!alreadyReloaded,
          },
        });

        if (!alreadyReloaded) {
          sessionStorage.setItem(RELOAD_SESSION_KEY, Date.now().toString());
          window.location.reload();
        }
        // If we already reloaded once and it didn't help, stay on Loading
        // rather than looping. The Sentry report will alert us.
      }, STALE_STATE_TIMEOUT);
    }

    return () => {
      if (staleTimerRef.current) {
        clearTimeout(staleTimerRef.current);
        staleTimerRef.current = null;
      }
    };
  }, [assigned, gameReady, game, stage, round, player]);

  // if the player is not ready, we show a loading screen
  if (!player) return <Loading />;

  // game gets rendered after the player completes the intro steps, even if they haven't been
  // assigned to a game. In that case, we show the lobby.
  if (!assigned) return <Lobby />;

  // with the unmanagedGame flag set on EmpiricaContext, we need
  // to manually check that the game and stage are ready before rendering
  if (!gameReady) return <Loading />;

  return (
    <>
      <ConfirmLeave />
      <div className="absolute top-0 left-0 right-0 h-12">
        <Profile />
      </div>
      <div className="absolute top-12 left-0 right-0 bottom-0 m-2">
        <Stage />
      </div>
    </>
  );
}
