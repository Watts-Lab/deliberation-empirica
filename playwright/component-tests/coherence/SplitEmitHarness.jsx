import React, { useEffect, useRef } from "react";
import {
  useGame,
  usePlayer,
  usePlayers,
  useRound,
  useStage,
} from "@empirica/core/player/classic/react";
import { SplitEmitEmpiricaProvider } from "../../mocks/empirica/SplitEmitEmpiricaProvider.jsx";
import { useStageCoherent } from "../../../client/src/components/stageCoherence";

/**
 * Minimal test harness for the torn-render probe.
 *
 * Renders a <CoherenceProbe> inside a split-emit provider. The probe logs
 * every render's { useStageId, playerStageStageID } to window.__probeRenders.
 *
 * Gated tests wrap the probe in a StageCoherenceGate (defined inline here)
 * that holds the render behind a loading sentinel whenever the coherence
 * helper returns false. That's the exact pattern Game.jsx will adopt.
 *
 * The harness drives one stage transition via ref.current.advance() and
 * signals completion by setting window.__probeDone = true, at which point
 * the test reads __probeRenders and asserts.
 *
 * Provider shape:
 *   - One self player + one peer, both with PlayerStage-A hydrated.
 *   - On advance(), transition to stage B with the requested race shape.
 */

function StageCoherenceGate({ children }) {
  const { coherent } = useStageCoherent();
  if (!coherent) return <div data-testid="gate-loading">Loading…</div>;
  return children;
}

function CoherenceProbe() {
  const stage = useStage();
  const player = usePlayer();
  const players = usePlayers();
  const game = useGame();
  const round = useRound();

  // Intentionally NOT calling computeStageCoherent from the probe. The
  // "coherent" flag is derived from primitive scope reads so the test never
  // uses the helper to both produce the race AND judge it — a circular
  // loop that would make a buggy helper pass its own tests.
  const useStageId = stage?.id ?? null;
  const playerStageStageID = player?.stage?.get("stageID") ?? null;
  const peer = players?.find((p) => p?.id !== player?.id) ?? null;
  const peerStageStageID = peer?.stage?.get("stageID") ?? null;
  const hasPlayerStage = !!player?.stage;
  const hasPeerStage = !!peer?.stage;
  const hasRound = !!round;
  const hasGame = !!game;

  // A render is incoherent if ANY of these primitive signals says so —
  // matches (but does not call) the helper's logic.
  const coherent =
    hasGame &&
    hasRound &&
    hasPlayerStage &&
    hasPeerStage &&
    useStageId !== null &&
    playerStageStageID === useStageId &&
    peerStageStageID === useStageId;

  const snapshot = {
    coherent,
    useStageId,
    playerStageStageID,
    peerStageStageID,
    hasPlayerStage,
    hasPeerStage,
    hasRound,
    hasGame,
    renderCount: (window.__probeRenderCount = (window.__probeRenderCount ?? 0) + 1),
    t: Math.round(performance.now()),
  };
  if (!window.__probeRenders) window.__probeRenders = [];
  window.__probeRenders.push(snapshot);
  return <div data-testid="probe">{stage?.id ?? "nil"}</div>;
}

export function SplitEmitHarness({ gated, race, gapMs = 30 }) {
  const providerRef = useRef(null);

  useEffect(() => {
    // Reset state from any prior render
    window.__probeRenders = [];
    window.__probeRenderCount = 0;
    window.__probeDone = false;

    const run = async () => {
      // Give React a tick to mount and record the initial (stage A) render.
      await new Promise((r) => setTimeout(r, 10));

      await providerRef.current.advance({
        toStageId: "stage-B",
        toStageAttrs: { name: "StageB" },
        perPlayerStageAttrs: {
          p0: {},
          p1: {},
        },
        race,
        gapMs,
      });

      // Allow a post-transition render to land before tests read the buffer.
      await new Promise((r) => setTimeout(r, gapMs + 30));
      window.__probeDone = true;
    };
    run();
  }, [race, gapMs]);

  const initialPlayerStages = {
    p0: { "stage-A": {} },
    p1: { "stage-A": {} },
  };

  const probeTree = <CoherenceProbe />;
  const wrapped = gated ? <StageCoherenceGate>{probeTree}</StageCoherenceGate> : probeTree;

  return (
    <SplitEmitEmpiricaProvider
      ref={providerRef}
      currentPlayerId="p0"
      initialStage={{ id: "stage-A", attrs: { name: "StageA" } }}
      initialGame={{ attrs: {} }}
      initialPlayerIds={["p0", "p1"]}
      initialPlayerStages={initialPlayerStages}
    >
      {wrapped}
    </SplitEmitEmpiricaProvider>
  );
}
