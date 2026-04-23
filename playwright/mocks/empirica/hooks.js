/**
 * ============================================================================
 * Mock Empirica Hooks - The Bridge Between React and Mock State
 * ============================================================================
 *
 * This module provides React hooks that read from MockEmpiricaContext. In
 * component tests, these hooks are aliased to replace the real Empirica hooks
 * via Vite config:
 *
 *   resolve: {
 *     alias: {
 *       '@empirica/core/player/classic/react': './mocks/empirica/hooks.js'
 *     }
 *   }
 *
 * When components import and call usePlayer(), they get our mock implementation
 * instead of the real one, allowing full control over the test environment.
 *
 * @see MockEmpiricaProvider.jsx - Creates the context and manages reactivity
 * @see MockPlayer.js - The mutable state pattern
 */

import { useContext } from "react";
import { MockEmpiricaContext } from "./MockEmpiricaProvider.jsx";
import { SplitEmitContext } from "./SplitEmitEmpiricaProvider.jsx";

// Prefer SplitEmitContext if mounted (split-emit tests opt in by mounting
// SplitEmitEmpiricaProvider). Otherwise fall back to the atomic
// MockEmpiricaContext. This keeps existing tests working unchanged while
// letting coherence tests drive races explicitly.
function useEmpiricaCtx() {
  const splitCtx = useContext(SplitEmitContext);
  const mockCtx = useContext(MockEmpiricaContext);
  return splitCtx ?? mockCtx ?? null;
}

export function usePlayer() {
  const ctx = useEmpiricaCtx();
  if (!ctx) {
    console.warn("usePlayer called outside an Empirica mock provider");
    return null;
  }
  // SplitEmit context exposes `player` directly; atomic mock exposes
  // `players` + `currentPlayerId`. Support both shapes.
  if ("player" in ctx) return ctx.player;
  const { currentPlayerId, players } = ctx;
  return players.find((p) => p.id === currentPlayerId) || null;
}

export function usePlayers() {
  const ctx = useEmpiricaCtx();
  if (!ctx) {
    console.warn("usePlayers called outside an Empirica mock provider");
    return [];
  }
  return ctx.players ?? [];
}

export function useGame() {
  const ctx = useEmpiricaCtx();
  if (!ctx) {
    console.warn("useGame called outside an Empirica mock provider");
    return null;
  }
  return ctx.game;
}

export function useStage() {
  const ctx = useEmpiricaCtx();
  if (!ctx) {
    console.warn("useStage called outside an Empirica mock provider");
    return null;
  }
  return ctx.stage;
}

export function useStageTimer() {
  const ctx = useEmpiricaCtx();
  if (!ctx) {
    console.warn("useStageTimer called outside an Empirica mock provider");
    return null;
  }
  return ctx.stageTimer ?? null;
}

export function useRound() {
  const ctx = useEmpiricaCtx();
  return ctx?.round ?? null;
}

// --------------- Progress Label Hooks ---------------

export function useProgressLabel() {
  const ctx = useContext(MockEmpiricaContext);
  if (!ctx) {
    console.warn("useProgressLabel called outside MockEmpiricaProvider");
    return "test_0_unknown";
  }
  return ctx.progressLabel;
}

export function useGetElapsedTime() {
  const ctx = useContext(MockEmpiricaContext);
  if (!ctx) {
    console.warn("useGetElapsedTime called outside MockEmpiricaProvider");
    return () => 0;
  }
  return ctx.getElapsedTime;
}

export function computeProgressLabel({ phase, index, name }) {
  return `${phase}_${index}_${name}`;
}

// --------------- Provider Components (pass-through) ---------------

export function StageProgressLabelProvider({ children }) {
  return children;
}

export function IntroExitProgressLabelProvider({ children }) {
  return children;
}
