import React from "react";
import { useStageTimer } from "@empirica/core/player/classic/react";

import { Progress } from "react-sweet-progress";
import "react-sweet-progress/lib/style.css";

export function KitchenTimer({ startTime, endTime, warnTimeRemaining = 10 }) {
  const stageTimer = useStageTimer();
  const stageElapsed = (stageTimer?.elapsed || 0) / 1000;
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
    <div className="m-1.5rem max-w-xl">
      <Progress percent={percent} theme={theme} status="default" />
    </div>
  );
}
