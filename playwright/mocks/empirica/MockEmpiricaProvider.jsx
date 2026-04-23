import React, {
  createContext,
  useState,
  useCallback,
  useLayoutEffect,
  useMemo,
} from "react";
import { MockPlayer } from "./MockPlayer.js";
import { MockGame } from "./MockGame.js";
import { MockStage } from "./MockStage.js";

/**
 * ============================================================================
 * MockEmpiricaProvider - Reactive State Management for Component Tests
 * ============================================================================
 *
 * This provider enables testing Empirica components in isolation by providing
 * mock implementations of player, game, and stage objects. It implements a
 * sophisticated reactivity system that mimics how the real Empirica runtime
 * propagates state changes.
 *
 * ## How Reactivity Works
 *
 * 1. **Mutation Detection**: Mock objects (MockPlayer, MockGame, MockStage)
 *    store their state in internal `_attributes` objects. When `set()` or
 *    `append()` is called, they mutate their state AND call `_onChange()`.
 *
 * 2. **Triggering Re-renders**: The `_onChange` callback is `handleChange`,
 *    which calls `forceUpdate()` to increment `renderCount` state. This
 *    triggers a re-render of MockEmpiricaProvider.
 *
 * 3. **Stable Instance References**: The `useMemo` hooks ensure that mock
 *    object INSTANCES remain stable across re-renders (same object references).
 *    This is CRITICAL - if instances changed, all mutations would be lost!
 *
 * 4. **Context Propagation**: When `renderCount` changes, the `contextValue`
 *    useMemo creates a NEW object reference. React Context detects this change
 *    and triggers re-renders of all consumer components (usePlayer, etc.).
 *
 * 5. **Fresh Data Reads**: When consumer components re-render, they call
 *    `player.get()` which reads from the (now mutated) `_attributes` object,
 *    seeing the updated values.
 *
 * ## Critical Design Decisions
 *
 * ### Why Stable Default Values?
 * Default parameter values like `players = []` create NEW array references on
 * EVERY render. This causes `useMemo([..., players])` to re-evaluate and
 * create brand new MockPlayer instances, destroying all state. Using stable
 * references (EMPTY_PLAYERS_ARRAY) defined outside the component prevents this.
 *
 * ### Why Not Include handleChange in useMemo Deps?
 * Even though `handleChange` is stable (from useCallback with empty deps),
 * including it in useMemo dependencies caused instance re-creation in practice.
 * Since handleChange is guaranteed stable and useLayoutEffect injects it
 * anyway, it's safe to omit from dependencies.
 *
 * ### Why Memoize contextValue with renderCount?
 * The contextValue object must get a NEW reference when state changes, so
 * React Context knows to update consumers. Including `renderCount` in the
 * useMemo dependencies ensures this happens after every forceUpdate.
 *
 * @see MockPlayer.js - Explains the _attributes mutation pattern
 * @see hooks.js - Shows how usePlayer() reads from this context
 */
export const MockEmpiricaContext = createContext(null);

// ============================================================================
// Stable Default Values
// ============================================================================
// These MUST be defined outside the component! Using inline literals like
// `players = []` creates NEW references on every render, breaking useMemo.
// React's useMemo uses Object.is() for comparison:
//   [] !== [] (different references!)
//   EMPTY_PLAYERS_ARRAY === EMPTY_PLAYERS_ARRAY (same reference)
const EMPTY_PLAYERS_ARRAY = [];

/**
 * Mock Empirica Provider for component tests
 *
 * Wraps components and provides mock Empirica state via context.
 * The aliased hooks (usePlayer, useGame, etc.) read from this context.
 */
export function MockEmpiricaProvider({
  currentPlayerId,
  players = EMPTY_PLAYERS_ARRAY, // OLD: MockPlayer instances (use stable default!)
  game = null, // OLD: MockGame instance
  stage = null, // OLD: MockStage instance
  playerConfigs = null, // NEW: Plain objects with {id, attrs}
  gameConfig = null, // NEW: Plain object with {attrs}
  stageConfig = null, // NEW: Plain object with {attrs}
  stageTimer = null,
  progressLabel: progressLabelProp = "test_0_stage",
  elapsedTime = 0,
  children,
}) {
  const [renderCount, forceUpdate] = useState(0);
  // Mid-test overridable progressLabel — exposed via
  // window.mockEmpiricaSetProgressLabel so tests that drive a simulated
  // stage transition without remounting can update the label and observe
  // downstream consumers react. Initializes from the prop.
  const [progressLabel, setProgressLabel] = useState(progressLabelProp);

  const handleChange = useCallback(() => {
    console.log(
      "[MockEmpiricaProvider] handleChange called - forcing re-render",
    );
    forceUpdate((n) => n + 1);
  }, []);

  const mockPlayers = useMemo(() => {
    if (playerConfigs) {
      return playerConfigs.map(
        (config) => new MockPlayer(config.id, config.attrs || {}, handleChange),
      );
    }
    return players;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerConfigs, players]); // handleChange intentionally omitted — it is stable (useCallback [])
  // but including it caused instance re-creation in practice. See comments in original provider.

  const mockGame = useMemo(() => {
    if (gameConfig) {
      return new MockGame(gameConfig.attrs || {}, handleChange);
    }
    return game;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameConfig, game]); // handleChange intentionally omitted

  const mockStage = useMemo(() => {
    if (stageConfig) {
      return new MockStage(stageConfig.attrs || {}, handleChange);
    }
    return stage;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageConfig, stage]); // handleChange intentionally omitted

  useLayoutEffect(() => {
    console.log(
      "[MockEmpiricaProvider] Injecting onChange into mocks (if needed)",
    );
    mockPlayers.forEach((player) => {
      if (player && !player._onChange) {
        console.log(
          `[MockEmpiricaProvider] Injecting onChange into player ${player.id}`,
        );
        player._onChange = handleChange;
        if (player.stage && !player.stage._onChange) {
          player.stage._onChange = handleChange;
        }
      }
    });
    if (mockGame && !mockGame._onChange) {
      console.log("[MockEmpiricaProvider] Injecting onChange into game");
      mockGame._onChange = handleChange;
    }
    if (mockStage && !mockStage._onChange) {
      console.log("[MockEmpiricaProvider] Injecting onChange into stage");
      mockStage._onChange = handleChange;
    }
  }, [mockPlayers, mockGame, mockStage, handleChange]);

  // Stabilize getElapsedTime so React hooks depending on it (e.g.
  // useStageEventLogger) don't see a new function identity every render,
  // which would re-run their effects on every re-render and — when combined
  // with a player.set inside the effect — cause an infinite re-render loop.
  const getElapsedTime = useCallback(
    () => (typeof elapsedTime === "function" ? elapsedTime() : elapsedTime),
    [elapsedTime],
  );

  const contextValue = useMemo(
    () => ({
      currentPlayerId,
      players: mockPlayers,
      game: mockGame,
      stage: mockStage,
      stageTimer,
      progressLabel,
      getElapsedTime,
    }),
    [
      renderCount,
      currentPlayerId,
      mockPlayers,
      mockGame,
      mockStage,
      stageTimer,
      progressLabel,
      getElapsedTime,
    ],
  );

  if (typeof window !== "undefined") {
    window.mockEmpiricaContext = contextValue;
    window.mockPlayers = mockPlayers;
    window.mockEmpiricaSetProgressLabel = setProgressLabel;
  }

  return (
    <MockEmpiricaContext.Provider value={contextValue}>
      {children}
    </MockEmpiricaContext.Provider>
  );
}
