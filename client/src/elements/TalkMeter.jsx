import React from "react";
import {
  usePlayer,
  //   useStage,
  useStageTimer,
} from "@empirica/core/player/classic/react";

// Todo:
// - format this with some nice styling
// - add some options for what parts of the timer to turn on or off

export function TalkMeter() {
  const player = usePlayer();
  //   const stage = useStage();
  const stageTimer = useStageTimer();
  const stageElapsed = (stageTimer?.elapsed || 0) / 1000;

  const playerStartedSpeakingAt = player.get("startedSpeakingAt");

  const speakingFor = playerStartedSpeakingAt
    ? stageElapsed - playerStartedSpeakingAt
    : "N/A";
  const previousSpeakingTime = player.get("cumulativeSpeakingTime") || 0;
  const cumulativeSpeakingTime = playerStartedSpeakingAt
    ? previousSpeakingTime + speakingFor
    : previousSpeakingTime;
  const proportion = cumulativeSpeakingTime / stageElapsed || 0;

  return (
    <div className="mt-4">
      <p>
        <strong>Started at:</strong>
        {playerStartedSpeakingAt}{" "}
      </p>
      <p>
        <strong>Current time:</strong> {stageElapsed}
      </p>
      <p>
        <strong>This turn:</strong> {speakingFor}
      </p>
      <p>
        <strong>Cumulative:</strong> {cumulativeSpeakingTime}
      </p>
      <p>
        <strong>Proportion:</strong> {proportion}
      </p>
    </div>
  );
}
