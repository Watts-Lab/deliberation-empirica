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

import { useContext } from 'react';
import { MockEmpiricaContext } from './MockEmpiricaProvider.jsx';

export function usePlayer() {
  const ctx = useContext(MockEmpiricaContext);
  if (!ctx) {
    console.warn('usePlayer called outside MockEmpiricaProvider');
    return null;
  }
  const { currentPlayerId, players } = ctx;
  return players.find(p => p.id === currentPlayerId) || null;
}

export function usePlayers() {
  const ctx = useContext(MockEmpiricaContext);
  if (!ctx) {
    console.warn('usePlayers called outside MockEmpiricaProvider');
    return [];
  }
  return ctx.players;
}

export function useGame() {
  const ctx = useContext(MockEmpiricaContext);
  if (!ctx) {
    console.warn('useGame called outside MockEmpiricaProvider');
    return null;
  }
  return ctx.game;
}

export function useStage() {
  const ctx = useContext(MockEmpiricaContext);
  if (!ctx) {
    console.warn('useStage called outside MockEmpiricaProvider');
    return null;
  }
  return ctx.stage;
}

export function useStageTimer() {
  const ctx = useContext(MockEmpiricaContext);
  if (!ctx) {
    console.warn('useStageTimer called outside MockEmpiricaProvider');
    return null;
  }
  return ctx.stageTimer;
}

export function useRound() {
  return null;
}

// --------------- Progress Label Hooks ---------------

export function useProgressLabel() {
  const ctx = useContext(MockEmpiricaContext);
  if (!ctx) {
    console.warn('useProgressLabel called outside MockEmpiricaProvider');
    return 'test_0_unknown';
  }
  return ctx.progressLabel;
}

export function useGetElapsedTime() {
  const ctx = useContext(MockEmpiricaContext);
  if (!ctx) {
    console.warn('useGetElapsedTime called outside MockEmpiricaProvider');
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
