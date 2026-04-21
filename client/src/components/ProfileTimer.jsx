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

// Header-bar clock shown in Profile.jsx during live game stages. Formats
// `useStageTimer()` remaining seconds as HH:MM:SS and respects
// `player.stage.get("overrideDuration")` so dispatch / ReportMissing can
// shorten the clock without waiting out the server-side timer.
//
// Distinct from stagebook's KitchenTimer element (which is the
// progress-bar element rendered inside a stage via `type: timer`).
export function ProfileTimer() {
  const timer = useStageTimer();
  const player = usePlayer();
  const [overrideOffset, setOverrideOffset] = useState(0);

  let remaining;
  if (timer?.remaining || timer?.remaining === 0) {
    remaining = Math.round(timer.remaining / 1000);
  }

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
    <h1 className="font-mono text-3xl text-gray-500 font-semibold mt-0">
      {humanTimer(remaining)}
    </h1>
  );
}
