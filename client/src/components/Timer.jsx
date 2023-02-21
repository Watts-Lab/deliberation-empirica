import { usePlayer, useStageTimer } from "@empirica/core/player/classic/react";
import React, { useEffect, useState } from "react";

function humanTimer(seconds) {
  if (seconds === null || seconds === undefined) {
    return "-";
  }

  // Since we will likely never run timer for longer than 24 hours, I think this works fine
  return new Date(1000 * seconds)
    .toISOString()
    .slice(seconds < 3600 ? 14 : 11, 19);
}

export function Timer() {
  const timer = useStageTimer();
  const player = usePlayer();

  let remaining;
  if (timer?.remaining || timer?.remaining === 0) {
    remaining = Math.round(timer.remaining / 1000);
  }

  const [overrideOffset, setOverrideOffset] = useState(0);
  useEffect(() => {
    if (!player?.stage) {
      setOverrideOffset(0);
      return;
    }

    const overrideDuration = player.stage.get("overrideDuration");
    if (overrideDuration < remaining) {
      setOverrideOffset(remaining - overrideDuration);
    }
  }, [player, remaining]);

  if (remaining && overrideOffset > 0) {
    remaining -= overrideOffset;
  }

  return (
    <div className="flex flex-col items-center">
      <h1 className="font-mono text-3xl text-gray-500 font-semibold">
        {humanTimer(remaining)}
      </h1>
    </div>
  );
}
