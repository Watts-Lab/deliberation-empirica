/**
 * ProgressLabelContext.jsx
 *
 * This module provides a unified system for tracking participant progress through
 * a Deliberation study and computing elapsed time within each step. It solves
 * several important problems:
 *
 * ## Why This Exists
 *
 * Deliberation studies have three distinct phases with different timing needs:
 *
 * 1. **Intro Steps** - Before the game starts (consent, instructions, surveys)
 *    - No server-side stage timer exists
 *    - Must track time client-side using Date.now()
 *
 * 2. **Game Stages** - During the actual experiment (discussions, tasks)
 *    - Empirica provides `useStageTimer()` with server-synchronized elapsed time
 *    - More accurate than client-side timing
 *
 * 3. **Exit Steps** - After the game ends (surveys, debriefing)
 *    - Same as intro steps: no stage timer, client-side timing required
 *
 * Previously, components like `TimeConditionalRender` and `KitchenTimer` had to
 * independently handle both cases, duplicating logic like:
 *
 *   const elapsed = stageTimer
 *     ? stageTimer.elapsed / 1000
 *     : (Date.now() - player.get("localStageStartTime")) / 1000;
 *
 * This context centralizes that logic and provides a consistent `getElapsedTime()`
 * function that works transparently in all phases.
 *
 * ## Race Conditions Avoided
 *
 * ### Stale progressLabel reads
 *
 * Previously, components would read `player.get("progressLabel")` to determine the
 * current step. But when transitioning between stages, the provider would compute
 * the new label and call `player.set("progressLabel", newLabel)`. Components
 * rendering before this update propagated would read the stale (previous) label.
 *
 * This context solves the problem by providing the freshly-computed `progressLabel`
 * directly via React context. The label is derived from props/stage data on each
 * render, so consumers always get the current value without waiting for the player
 * object to sync.
 *
 * ### Atomic label + startTime updates
 *
 * The original implementation stored `progressLabel` and `localStageStartTime` as
 * separate player attributes:
 *
 *   player.set("progressLabel", label);
 *   player.set("localStageStartTime", Date.now());
 *
 * This created a race condition: if a component read `localStageStartTime` between
 * these two calls (or if the second call failed), the label and start time would
 * be out of sync. Components might compute elapsed time against the wrong stage.
 *
 * We now use a `stageHistory` array that stores label and startTime together:
 *
 *   stageHistory: [
 *     { label: "intro_0_consent", startTime: 1707123456789 },
 *     { label: "intro_1_instructions", startTime: 1707123556789 },
 *     { label: "game_0_discussion", startTime: 1707123656789 },
 *   ]
 *
 * Each entry is written atomically, ensuring label and startTime are always paired.
 *
 * ## Page Refresh Resilience
 *
 * When a participant refreshes their browser mid-step, we need to resume timing
 * from where they left off, not restart from zero. The `stageHistory` array is
 * persisted to the player object, so on refresh:
 *
 * 1. The provider mounts and computes the current `progressLabel`
 * 2. It checks `stageHistory` for an existing entry with that label
 * 3. If found (refresh case): uses the stored `startTime`
 * 4. If not found (new step): creates a new entry with `Date.now()`
 *
 * This ensures timed elements (like "show submit button after 10 seconds") work
 * correctly even if the participant refreshes at second 7.
 *
 * ## Architecture
 *
 * Two providers serve different phases:
 *
 * - `StageProgressLabelProvider` - Wraps game stages, uses Empirica's stage timer
 *   when available for maximum accuracy
 *
 * - `IntroExitProgressLabelProvider` - Wraps intro/exit steps, receives phase/index/name
 *   as props and tracks time client-side
 *
 * Both provide the same context interface:
 * - `progressLabel` - Current step identifier (e.g., "intro_0_consent", "game_2_discussion")
 * - `getElapsedTime()` - Function returning seconds since step started
 *
 * Consumer hooks:
 * - `useProgressLabel()` - Get the current progress label
 * - `useGetElapsedTime()` - Get the elapsed time function
 *
 * ## Usage Example
 *
 * ```jsx
 * // In a component wrapped by either provider:
 * function MyComponent() {
 *   const progressLabel = useProgressLabel();
 *   const getElapsedTime = useGetElapsedTime();
 *
 *   const handleSubmit = () => {
 *     console.log(`Submitted ${progressLabel} after ${getElapsedTime()} seconds`);
 *   };
 * }
 * ```
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  usePlayer,
  useStage,
  useStageTimer,
} from "@empirica/core/player/classic/react";
import { computeProgressLabel } from "./progressLabelUtils";

export { computeProgressLabel };

const ProgressContext = createContext(null);

/**
 * Provider for game stages.
 *
 * Wraps game stage content and provides:
 * - `progressLabel` computed from the Empirica stage object
 * - `getElapsedTime()` using Empirica's server-synchronized stage timer
 *
 * The stage timer is preferred during game stages because it's synchronized
 * across all participants and survives brief network interruptions. We fall
 * back to local time tracking (via stageHistory) if the timer isn't available.
 *
 * @example
 * // In Game.jsx or Stage.jsx:
 * <StageProgressLabelProvider>
 *   <StageContent />
 * </StageProgressLabelProvider>
 */
export function StageProgressLabelProvider({ children }) {
  const player = usePlayer();
  const stage = useStage();
  const stageTimer = useStageTimer();
  const startTimeRef = useRef(null);

  // Store stageTimer in a ref so getElapsedTime can always access current value
  // without being recreated (which would cause effects to re-run)
  const stageTimerRef = useRef(stageTimer);
  stageTimerRef.current = stageTimer;

  // Compute progress label from Empirica stage properties
  const progressLabel = useMemo(() => {
    if (!stage) return null;
    return computeProgressLabel({
      phase: "game",
      index: stage.get("index"),
      name: stage.get("name"),
    });
  }, [stage]);

  // Persist progress to player state for analytics and refresh resilience
  // Uses stageHistory array to atomically store label + startTime together
  const prevLabelRef = useRef(null);
  useEffect(() => {
    if (!progressLabel || !player) return;
    if (progressLabel === prevLabelRef.current) return;

    const history = player.get("stageHistory") || [];
    const existingEntry = history.find((e) => e.label === progressLabel);

    if (existingEntry) {
      // Refresh case: participant reloaded the page mid-stage
      // Use the original start time so elapsed calculations remain accurate
      startTimeRef.current = existingEntry.startTime;
      console.log(`Resuming ${progressLabel} (refresh detected)`);
    } else {
      // New stage: record entry with current timestamp
      // Using player.append() ensures atomic addition to the array
      startTimeRef.current = Date.now();
      player.append("stageHistory", {
        label: progressLabel,
        startTime: startTimeRef.current,
      });
      console.log(`Starting ${progressLabel}`);
    }

    // Also store progressLabel separately for easy access by analytics/monitoring
    if (player.get("progressLabel") !== progressLabel) {
      player.set("progressLabel", progressLabel);
    }

    prevLabelRef.current = progressLabel;
  }, [progressLabel, player]);

  /**
   * Returns elapsed seconds since the current stage started.
   *
   * Prefers Empirica's stage timer when available because it's:
   * - Server-synchronized across all participants
   * - More accurate for coordinated multi-player activities
   * - Resilient to brief client-side clock issues
   *
   * Falls back to local time tracking (from stageHistory) if timer unavailable.
   *
   * NOTE: This function is stable (empty deps) and always returns current values
   * by reading from stageTimerRef. This prevents effects that use getElapsedTime
   * from re-running every time the timer ticks, while still getting fresh values.
   */
  const getElapsedTime = useCallback(() => {
    if (stageTimerRef.current?.elapsed !== undefined) {
      return stageTimerRef.current.elapsed / 1000;
    }
    if (startTimeRef.current) {
      return (Date.now() - startTimeRef.current) / 1000;
    }
    return 0;
  }, []); // Empty deps → stable function, never recreated

  const value = useMemo(
    () => ({
      progressLabel,
      getElapsedTime,
    }),
    [progressLabel, getElapsedTime]
  );

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
}

/**
 * Provider for intro and exit steps.
 *
 * Wraps intro/exit step content and provides:
 * - `progressLabel` computed from phase/index/name props
 * - `getElapsedTime()` using client-side time tracking
 *
 * Unlike game stages, intro/exit steps don't have an Empirica stage timer,
 * so we track time locally using Date.now(). The stageHistory array ensures
 * this survives page refreshes.
 *
 * @param {string} phase - "intro" or "exit"
 * @param {number} index - Step index within the phase
 * @param {string} name - Step name from treatment configuration
 *
 * @example
 * // In GenericIntroExitStep.jsx:
 * <IntroExitProgressLabelProvider phase="intro" index={0} name="consent">
 *   <StepContent />
 * </IntroExitProgressLabelProvider>
 */
export function IntroExitProgressLabelProvider({
  phase,
  index,
  name,
  children,
}) {
  const player = usePlayer();
  const startTimeRef = useRef(null);

  // Compute progress label from props (not from Empirica stage)
  const progressLabel = useMemo(
    () => computeProgressLabel({ phase, index, name }),
    [phase, index, name]
  );

  // Persist progress to player state for analytics and refresh resilience
  // Uses stageHistory array to atomically store label + startTime together
  const prevLabelRef = useRef(null);
  useEffect(() => {
    if (!progressLabel || !player) return;
    if (progressLabel === prevLabelRef.current) return;

    const history = player.get("stageHistory") || [];
    const existingEntry = history.find((e) => e.label === progressLabel);

    if (existingEntry) {
      // Refresh case: participant reloaded the page mid-step
      // Use the original start time so timed elements (displayTime, hideTime)
      // continue working correctly from where they left off
      startTimeRef.current = existingEntry.startTime;
      console.log(`Resuming ${progressLabel} (refresh detected)`);
    } else {
      // New step: record entry with current timestamp
      // Using player.append() ensures atomic addition to the array
      startTimeRef.current = Date.now();
      player.append("stageHistory", {
        label: progressLabel,
        startTime: startTimeRef.current,
      });
      console.log(`Starting ${progressLabel}`);
    }

    // Also store progressLabel separately for easy access by analytics/monitoring
    if (player.get("progressLabel") !== progressLabel) {
      player.set("progressLabel", progressLabel);
    }

    prevLabelRef.current = progressLabel;
  }, [progressLabel, player]);

  /**
   * Returns elapsed seconds since the current step started.
   *
   * Uses client-side Date.now() since intro/exit steps don't have
   * an Empirica stage timer. The startTimeRef is initialized from
   * stageHistory to survive page refreshes.
   */
  const getElapsedTime = useCallback(() => {
    if (startTimeRef.current == null) {
      return 0;
    }
    return (Date.now() - startTimeRef.current) / 1000;
  }, []);

  const value = useMemo(
    () => ({
      progressLabel,
      getElapsedTime,
    }),
    [progressLabel, getElapsedTime]
  );

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
}

/**
 * Hook to get the current progress label.
 *
 * The progress label is a string identifying the current step, formatted as:
 * - Intro: "intro_0_consent", "intro_1_instructions"
 * - Game: "game_0_discussion", "game_1_survey"
 * - Exit: "exit_0_debrief"
 *
 * Must be used within a StageProgressLabelProvider or IntroExitProgressLabelProvider.
 *
 * @returns {string} The current progress label
 * @throws {Error} If used outside of a provider
 *
 * @example
 * const progressLabel = useProgressLabel();
 * player.set(`response_${progressLabel}`, answer);
 */
export function useProgressLabel() {
  const ctx = useContext(ProgressContext);

  if (ctx === null) {
    throw new Error(
      "useProgressLabel must be used within a StageProgressLabelProvider or IntroExitProgressLabelProvider"
    );
  }

  return ctx.progressLabel;
}

/**
 * Hook to get a function that returns elapsed time in seconds for the current step.
 *
 * The returned function computes elapsed time on each call, which is necessary
 * for components that need to check elapsed time repeatedly (like timers or
 * time-conditional renders).
 *
 * During game stages: Uses Empirica's server-synchronized stage timer
 * During intro/exit: Uses client-side time tracking with refresh resilience
 *
 * Must be used within a StageProgressLabelProvider or IntroExitProgressLabelProvider.
 *
 * @returns {function(): number} Function that returns elapsed time in seconds
 * @throws {Error} If used outside of a provider
 *
 * @example
 * const getElapsedTime = useGetElapsedTime();
 *
 * // In a submit handler:
 * player.set("duration", getElapsedTime());
 *
 * // In a time-conditional render:
 * if (getElapsedTime() > displayTime) { ... }
 */
export function useGetElapsedTime() {
  const ctx = useContext(ProgressContext);

  if (ctx === null) {
    throw new Error(
      "useGetElapsedTime must be used within a StageProgressLabelProvider or IntroExitProgressLabelProvider"
    );
  }

  return ctx.getElapsedTime;
}
