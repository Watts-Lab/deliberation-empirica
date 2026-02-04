import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";
import { useStage, useStageTimer } from "@empirica/core/player/classic/react";
import { computeProgressLabel } from "./progressLabelUtils";

export { computeProgressLabel };

const ProgressContext = createContext(null);

/**
 * Provider for game stages. Computes progressLabel from the stage object
 * and provides elapsed time from the stage timer.
 */
export function StageProgressLabelProvider({ children }) {
  const stage = useStage();
  const stageTimer = useStageTimer();

  const progressLabel = useMemo(() => {
    if (!stage) return null;
    return computeProgressLabel({
      phase: "game",
      index: stage.get("index"),
      name: stage.get("name"),
    });
  }, [stage]);

  // Log stage transitions for debugging
  const prevLabelRef = useRef(null);
  if (progressLabel && progressLabel !== prevLabelRef.current) {
    console.log(`Starting ${progressLabel}`);
    prevLabelRef.current = progressLabel;
  }

  const getElapsedSeconds = useCallback(() => {
    if (stageTimer?.elapsed !== undefined) {
      return stageTimer.elapsed / 1000;
    }
    return 0;
  }, [stageTimer]);

  const value = useMemo(
    () => ({
      progressLabel,
      getElapsedSeconds,
    }),
    [progressLabel, getElapsedSeconds]
  );

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
}

/**
 * Provider for intro/exit steps. Receives phase, index, and name as props.
 * Tracks elapsed time from when the provider mounts.
 */
export function IntroExitProgressLabelProvider({
  phase,
  index,
  name,
  children,
}) {
  const startTimeRef = useRef(Date.now());

  const progressLabel = useMemo(
    () => computeProgressLabel({ phase, index, name }),
    [phase, index, name]
  );

  // Log step transitions for debugging
  const prevLabelRef = useRef(null);
  if (progressLabel && progressLabel !== prevLabelRef.current) {
    console.log(`Starting ${progressLabel}`);
    prevLabelRef.current = progressLabel;
  }

  // Reset start time when progressLabel changes (new step)
  const prevProgressLabelRef = useRef(progressLabel);
  if (progressLabel !== prevProgressLabelRef.current) {
    startTimeRef.current = Date.now();
    prevProgressLabelRef.current = progressLabel;
  }

  const getElapsedSeconds = useCallback(() => {
    return (Date.now() - startTimeRef.current) / 1000;
  }, []);

  const value = useMemo(
    () => ({
      progressLabel,
      getElapsedSeconds,
    }),
    [progressLabel, getElapsedSeconds]
  );

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
}

/**
 * Hook to get the current progressLabel.
 * Must be used within a StageProgressLabelProvider or IntroExitProgressLabelProvider.
 *
 * @returns {string} The current progress label
 * @throws {Error} If used outside of a provider
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
 * Hook to get a function that returns elapsed seconds for the current step.
 * During game stages, uses the Empirica stage timer.
 * During intro/exit steps, uses local time tracking.
 *
 * @returns {function(): number} Function that returns elapsed seconds
 * @throws {Error} If used outside of a provider
 */
export function useStepElapsedGetter() {
  const ctx = useContext(ProgressContext);

  if (ctx === null) {
    throw new Error(
      "useStepElapsedGetter must be used within a StageProgressLabelProvider or IntroExitProgressLabelProvider"
    );
  }

  return ctx.getElapsedSeconds;
}
