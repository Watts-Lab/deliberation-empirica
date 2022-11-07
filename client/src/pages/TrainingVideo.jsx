import { usePlayer, useStageTimer } from "@empirica/core/player/classic/react";
import React, { useState, useEffect } from "react";
import ReactPlayer from "react-player";
import { H4 } from "../components/TextStyles";

export function TrainingVideo({ url }) {
  const timer = useStageTimer();
  const player = usePlayer();
  const [elapsedOnLoad, setElapsedOnLoad] = useState(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    console.log(`Playing video from: ${url}`);

    const rawElapsed = timer?.ellapsed || 0.1; // avoid div0
    let timeElapsed = Math.floor(rawElapsed / 1000);
    if (timeElapsed < 5) {
      // restart if less than a few seconds have passed
      timeElapsed = 0;
    }
    setElapsedOnLoad(timeElapsed);
    console.log(`timeElapsed: ${timeElapsed}`);
  }, []);

  const handleReady = () => {
    const delay = setTimeout(() => setPlaying(true), 2000);
    console.log("Set play delay");
    return () => clearTimeout(delay);
  };

  const handleDuration = (duration) => {
    console.log(`Video duration: ${duration}`);
    // NOTE(@npaton): Instead of changing the timer directly we can set an
    // override of the duration we want the user to see.
    player.stage.set("overrideDuration", duration);
  };

  const handleEnded = () => {
    const delay = setTimeout(() => player.stage.set("submit", true), 1000);
    return () => clearTimeout(delay);
  };

  return (
    <div className="mt-5">
      <H4>Please take a moment to watch the following training video</H4>

      <div
        className="min-w-sm max-h-[85vh] aspect-video relative"
        data-test="reactPlayer"
      >
        {elapsedOnLoad !== null ? (
          <ReactPlayer
            className="absolute"
            width="100%"
            height="100%"
            url={url}
            config={{
              youtube: {
                playerVars: {
                  start: elapsedOnLoad,
                },
              },
            }}
            playing={playing}
            volume={1}
            muted={false}
            onReady={handleReady}
            onDuration={handleDuration}
            onEnded={handleEnded}
            style={{ pointerEvents: "none" }}
          />
        ) : (
          <H4>Loading video player</H4>
        )}
      </div>
    </div>
  );
}
