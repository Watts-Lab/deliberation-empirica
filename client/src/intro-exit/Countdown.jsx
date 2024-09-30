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
  const [lastPlayed, setLastPlayed] = useState(0);

  const localClockOffsetMS = player.get("localClockOffsetMS") || 0;
  const localLaunchDate = Date.parse(launchDate) + localClockOffsetMS;
  // console.log("Local Launch Date: ", localLaunchDate);

  useEffect(() => {
    if (!player.get("inCountdown")) {
      player.set("inCountdown", true);
      player.set("localClockTime", Date.now());
      console.log("Intro: Countdown");
    }
  }, [player]);

  const renderProceed = ({ hours, minutes, seconds }) => (
    <div className="text-center">
      <h1>Part 2 is ready to begin. 👥</h1>
      <Button testId="proceedButton" id="proceed" handleClick={next}>
        Proceed to study
      </Button>
      <p>
        Part 2 of the study has been live for {zeroPad(hours)}:
        {zeroPad(minutes)}:{zeroPad(seconds)}
      </p>
      <h3>
        {" "}
        If you cannot participate now, please return the study and close this
        window.{" "}
      </h3>
    </div>
  );

  const renderWait = ({ hours, minutes, seconds }) => (
    <div className="text-center">
      <h1>Keep this window open</h1>
      <p>Thanks for completing Part 1. 👤 </p>
      <h1>
        Part 2 👥 begins in {zeroPad(hours)}:{zeroPad(minutes)}:
        {zeroPad(seconds)}
      </h1>
      <h1>
        Keep this window open. You will be redirected to the next part when it
        begins.
      </h1>
      <p>Feel free to work on other things in the meantime.</p>
      <p>We will sound a chime when the study begins. ⏰</p>
      <br />
      <h3>
        If you cannot participate at the scheduled time, please return the study
        and close this window.
      </h3>
    </div>
  );

  const renderTimer = ({ hours, minutes, seconds, completed }) =>
    completed
      ? renderProceed({ hours, minutes, seconds })
      : renderWait({ hours, minutes, seconds });

  const playChime = () => {
    const now = Date.now();
    if (now > lastPlayed + 118 * 1000) {
      chime.play();
      setLastPlayed(now);
      console.log("Played 'Ready' Chime");
      setTimeout(playChime, 1000 * 90); // Play chime every 90 seconds
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
