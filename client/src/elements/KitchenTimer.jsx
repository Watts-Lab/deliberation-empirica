import React, { useState, useEffect } from "react";
import { Progress } from "react-sweet-progress";
import "react-sweet-progress/lib/style.css";
import { useGetElapsedTime } from "../components/progressLabel";

export function KitchenTimer({ startTime, endTime, warnTimeRemaining = 10 }) {
  const getElapsedTime = useGetElapsedTime();
  // tickTock triggers re-renders to update timer display
  // eslint-disable-next-line no-unused-vars
  const [tickTock, setTickTock] = useState(false);

  useEffect(() => {
    // Re-render periodically to update the timer display
    const tickTockInterval = setInterval(
      () => setTickTock((prev) => !prev),
      1000
    );
    return () => clearInterval(tickTockInterval);
  }, []);

  const stageElapsed = getElapsedTime();

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
