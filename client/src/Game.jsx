import React, { useEffect } from "react";
import * as Sentry from "@sentry/react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Loading } from "stagebook/components";
import { Profile } from "./Profile";
import { Stage } from "./Stage";
import { Lobby } from "./intro-exit/Lobby";
import { ConfirmLeave } from "./components/ConfirmLeave";
import {
  useStageCoherent,
  useStuckCoherenceRecovery,
} from "./components/stageCoherence";

export function Game() {
  const player = usePlayer();
  const assigned = player?.get("assigned");
  const position = player?.get("position");

  // Coherence gate — see client/src/components/stageCoherence/ for the
  // race analysis and why we need this in addition to `unmanagedGame: true`.
  const { coherent, diagnosis } = useStageCoherent();

  // Attach player position as Sentry tag when assigned to a game.
  useEffect(() => {
    if (assigned && position != null) {
      Sentry.setTag("position", String(position));
    }
  }, [assigned, position]);

  // Recover from stuck coherence by reporting to Sentry and reloading once.
  // Triggered when the gate has been non-coherent for 5s while assigned.
  useStuckCoherenceRecovery({
    assigned,
    diagnosis,
    extraPayload: { playerId: player?.id },
  });

  // if the player is not ready, we show a loading screen
  if (!player) return <Loading />;

  // game gets rendered after the player completes the intro steps, even if
  // they haven't been assigned to a game. In that case, we show the lobby.
  if (!assigned) return <Lobby />;

  // Hold the in-game tree until all scope observables agree on the current
  // stage. `unmanagedGame: true` on EmpiricaContext opts out of Empirica's
  // built-in gate; this is the replacement, with an extra identity check
  // that Empirica's own `useAllReady` doesn't cover. See
  // client/src/components/stageCoherence/.
  if (!coherent) return <Loading />;

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
