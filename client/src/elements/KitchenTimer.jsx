import React, { useState, useEffect } from "react";
import { useStageTimer, usePlayer } from "@empirica/core/player/classic/react";
import { Progress } from "react-sweet-progress";
import "react-sweet-progress/lib/style.css";

export function KitchenTimer({ startTime, endTime, warnTimeRemaining = 10 }) {
  const stageTimer = useStageTimer();
  const player = usePlayer();
  const [trigger, setTrigger] = useState(false); // State to trigger re-render every second in intro/exit

  useEffect(() => {
    // during intro/exit steps, need to manually re-render to display the timer ticking
    if (stageTimer) return () => null; // Game is running, don't need triggers to rerender
    const timeoutId = setTimeout(() => {
      setTrigger((prev) => !prev); // Toggle the trigger state
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [trigger, stageTimer]);

  const stageElapsedMs = stageTimer
    ? stageTimer.elapsed || 0
    : Date.now() - player.get("localStageStartTime");
  const stageElapsed = stageElapsedMs / 1000;

  const timerDuration = endTime - startTime;

  // not started
  let timerElapsed = 0;
  let timerRemaining = timerDuration;

  if (stageElapsed > startTime) {
    // running
    timerElapsed = stageElapsed - startTime;
    timerRemaining = endTime - stageElapsed;
  }

  if (stageElapsed > endTime) {
    // expired
    timerElapsed = timerDuration;
    timerRemaining = 0;
  }
  const percent = (timerElapsed / timerDuration) * 100;
  const displayRemaining = new Date(1000 * timerRemaining)
    .toISOString()
    .slice(timerRemaining < 3600 ? 14 : 11, 19);

  const theme = {
    default: {
      symbol: displayRemaining,
      color: timerRemaining > warnTimeRemaining ? "lightblue" : "red",
    },
  };

  return (
    <div
      className="m-1.5rem max-w-xl"
      data-test={`timer_start_${startTime}_end_${endTime}`}
    >
      <Progress percent={percent} theme={theme} status="default" />
    </div>
  );
}
