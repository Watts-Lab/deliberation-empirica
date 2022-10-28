import { useGame } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";
import { VideoCall } from "../components/VideoCall";
import { H3 } from "../components/TextStyles";

export function Discussion({ dailyRef, dailyIframe }) {
  const game = useGame();
  const dailyUrl = game.get("dailyUrl");

  // eslint-disable-next-line consistent-return -- not a mistake
  useEffect(() => {
    console.log(`Discussion Room URL: ${dailyUrl}`);
  }, []);

  return (
    <div className="relative min-h-sm h-full">
      {dailyUrl ? (
        <VideoCall dailyElement={dailyRef} dailyIframe={dailyIframe} roomUrl={dailyUrl} record />
      ) : (
        <H3> Loading meeting room... </H3>
      )}
    </div>
  );
}
