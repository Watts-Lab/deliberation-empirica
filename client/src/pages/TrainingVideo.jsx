import { usePlayer,useStageTimer } from "@empirica/core/player/classic/react";
import React, { useState, useEffect } from "react";
import ReactPlayer from "react-player";
import { H4 } from "../components/TextStyles";

export function TrainingVideo({ url }) {

  const timer = useStageTimer();
  let timeEllapsed;
  useEffect(() => {
    console.log(`Playing video from: ${url}`);
    console.log(timer.ellapsed/1000);
    timeEllapsed = timer.ellapsed/1000;
  }, []);
  const player = usePlayer();
  const [playing, setPlaying] = useState(false);

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


        <ReactPlayer
          className="absolute"
          width="100%"
          height="100%"
          url={url}
          config={{
            youtube: {
              playerVars: { start: {timeEllapsed} ,
              origin: 'http://localhost:3000' }
            }
          }}
          playing={playing}
          volume={1}
          muted={false}
          onReady={handleReady}
          onDuration={handleDuration}
          onEnded={handleEnded}
          style={{ pointerEvents: "none" }}
        />
      </div>
    </div>
  );
});
