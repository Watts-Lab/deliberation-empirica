/*
Countdown.jsx
James Houghton
Used for synchronizing participants. Goes after intro steps, just before lobby.

*/
import React, { useEffect, useState } from "react";
import { default as ReactCountdown, zeroPad } from "react-countdown";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Button } from "../components/Button";

export function Countdown({ launchDate, next }) {
  const chime = new Audio("westminster_quarters.mp3");
  const player = usePlayer();
  const [hasPlayed, setHasPlayed] = useState(false);

  const localClockOffsetMS = player.get("localClockOffsetMS") || 0;
  const localLaunchDate = Date.parse(launchDate) + localClockOffsetMS;

  useEffect(() => {
    if (!player.get("inCountdown")) {
      player.set("inCountdown", true);
      player.set("localClockTime", Date.now());
      console.log("Intro: Countdown");
    }
  }, [player]);

  const renderProceed = ({ hours, minutes, seconds }) => (
    <div className="text-center">
      <h1>The study is ready to begin.</h1>
      <Button testId="proceedButton" id="proceed" handleClick={next}>
        Proceed to study
      </Button>
      <p>
        The study has been live for {zeroPad(hours)}:{zeroPad(minutes)}:
        {zeroPad(seconds)}
      </p>
    </div>
  );

  const renderWait = ({ hours, minutes, seconds }) => (
    <div className="text-center">
      <h1>Keep this window open</h1>
      <p>Thanks for completing the qualification steps.</p>
      <h1>
        The study begins in {zeroPad(hours)}:{zeroPad(minutes)}:
        {zeroPad(seconds)}
      </h1>
      <h1>
        Keep this window open. You will be redirected to the study when it
        begins.
      </h1>
      <p>Feel free to work on other things in the meantime.</p>
      <p>We will sound a chime when the study begins.</p>
    </div>
  );

  const renderTimer = ({ hours, minutes, seconds, completed }) =>
    completed
      ? renderProceed({ hours, minutes, seconds })
      : renderWait({ hours, minutes, seconds });

  const playChime = () => {
    if (!hasPlayed) {
      chime.play();
      setHasPlayed(true);
      console.log("Played Ready Chime");
    }
  };

  return (
    <ReactCountdown
      date={localLaunchDate}
      renderer={renderTimer}
      onComplete={playChime}
      overtime
    />
  );
}
