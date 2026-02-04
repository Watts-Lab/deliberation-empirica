import React, { createContext, useContext, useEffect, useMemo } from "react";
import { usePlayer, useStage } from "@empirica/core/player/classic/react";
import { computeProgressLabel } from "./progressLabelUtils";

export { computeProgressLabel };

const ProgressLabelContext = createContext(null);

/**
 * Provider for game stages. Computes progressLabel from the stage object.
 * Also syncs the computed label to player state for server-side access.
 */
export function StageProgressLabelProvider({ children }) {
  const stage = useStage();
  const player = usePlayer();

  const progressLabel = useMemo(() => {
    if (!stage) return null;
    return computeProgressLabel({
      phase: "game",
      index: stage.get("index"),
      name: stage.get("name"),
    });
  }, [stage]);

  // Sync to player state for server-side data export
  useEffect(() => {
    if (!player || !progressLabel) return;
    if (player.get("progressLabel") === progressLabel) return;

    console.log(`Starting ${progressLabel}`);
    player.set("progressLabel", progressLabel);
    player.set("localStageStartTime", undefined); // force use of stageTimer
  }, [progressLabel, player]);

  return (
    <ProgressLabelContext.Provider value={progressLabel}>
      {children}
    </ProgressLabelContext.Provider>
  );
}

/**
 * Provider for intro/exit steps. Receives phase, index, and name as props.
 * Also syncs the computed label to player state for server-side access.
 */
export function IntroExitProgressLabelProvider({
  phase,
  index,
  name,
  children,
}) {
  const player = usePlayer();

  const progressLabel = useMemo(
    () => computeProgressLabel({ phase, index, name }),
    [phase, index, name]
  );

  // Sync to player state for server-side data export
  useEffect(() => {
    if (!player || !progressLabel) return;
    if (player.get("progressLabel") === progressLabel) return;

    console.log(`Starting ${progressLabel}`);
    player.set("progressLabel", progressLabel);
    player.set("localStageStartTime", Date.now());
  }, [player, progressLabel]);

  return (
    <ProgressLabelContext.Provider value={progressLabel}>
      {children}
    </ProgressLabelContext.Provider>
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
  const progressLabel = useContext(ProgressLabelContext);

  if (progressLabel === null) {
    throw new Error(
      "useProgressLabel must be used within a StageProgressLabelProvider or IntroExitProgressLabelProvider"
    );
  }

  return progressLabel;
}
