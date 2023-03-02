/*
This component plays a video during the synchronous phase of the game, 
and so requires that participants begin and end the video at the same time.

To handle cases where a player disconnects, we start a reconnecting player
at (about) the same place in the video that they would be in had they not 
disconnected. This means that if they disconnect, they will miss some of 
the video, but it will not force the other participants to wait for them
to finish.
*/

import { usePlayer, useStageTimer } from "@empirica/core/player/classic/react";
import React, { useState, useEffect } from "react";
import ReactPlayer from "react-player";
import { Button } from "../components/Button";
import { H4 } from "../components/TextStyles";

export function TrainingVideo({ url }) {
  const timer = useStageTimer();
  const player = usePlayer();
  const [elapsedOnLoad, setElapsedOnLoad] = useState(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    console.log(`Playing video from: ${url}`);

    // test if autoplay will work
    const testAudio = new Audio("1sec_silence.mp3");
    const promise = testAudio.play();
    if (promise !== undefined) {
      promise
        .then(() => {
          setPlaying(true);
        })
        .catch(() => {
          setPlaying(false); // Autoplay was prevented.
          console.log("Cannot autoplay test sound, displaying play button");
        });
    }

    const rawElapsed = timer?.elapsed || 0.1; // avoid div0
    let timeElapsed = Math.floor(rawElapsed / 1000);
    if (timeElapsed < 5) {
      // restart if less than a few seconds have passed
      timeElapsed = 0;
    }
    setElapsedOnLoad(timeElapsed);
  }, []);

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
      <H4>Please take a moment to watch the following video</H4>

      {!playing && (
        <div className="text-center">
          <H4>Video is hidden on page refresh.</H4>
          <Button
            handleClick={() => {
              setPlaying(true);
              player.set("restartingVideo", true);
            }}
          >
            Click to continue the video
          </Button>
        </div>
      )}

      {playing && (
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
              onDuration={handleDuration}
              onEnded={handleEnded}
              onError={(e) => console.log(e)}
              style={{ pointerEvents: "none" }}
            />
          ) : (
            <H4>Loading video player</H4>
          )}
        </div>
      )}
    </div>
  );
}
