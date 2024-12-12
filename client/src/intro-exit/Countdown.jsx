/*
Countdown.jsx
James Houghton
Used for synchronizing participants. Goes after intro steps, just before lobby.

*/
import React, { useEffect, useState } from "react";
import { default as ReactCountdown, zeroPad } from "react-countdown";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Button } from "../components/Button";
import { useIdleContext } from "../components/IdleProvider";

export function Countdown({ launchDate, next }) {
  const player = usePlayer();
  const { setAllowIdle } = useIdleContext();

  const localClockOffsetMS = player.get("localClockOffsetMS") || 0; // localClockOffsetMS is positive if the player's clock is ahead of the server's
  const localLaunchDate = Date.parse(launchDate) + localClockOffsetMS; // When the clock is ahead, want to launch later, according to the local clock
  const [launched, setLaunched] = useState(Date.now() > localLaunchDate);

  useEffect(() => {
    // Set allowIdle to true when the component loads
    // if the study has not yet launched
    console.log("Countdown useEffect, launched:", launched);
    if (!launched) {
      setAllowIdle(true);
      console.log("Set Allow Idle for Countdown");
    }

    // Reset allowIdle to false when the component unloads or launches
    return () => {
      setAllowIdle(false);
      console.log("Clear Allow Idle on Launch");
    };
  }, [setAllowIdle, launched]);

  useEffect(() => {
    // console.log("Launched useEffect", launched);
    if (!launched) return () => {};

    let lastPlayed = 0;
    let playedTimes = 0;
    const chime = new Audio("westminster_quarters.mp3");

    const playChime = () => {
      const now = Date.now();
      if (now > lastPlayed + 5 * 1000) {
        playedTimes += 1;
        lastPlayed = now;
        console.log(`Played Ready Chime ${playedTimes} times`);
        chime.play();
      }
    };

    playChime(); // Play chime immediately
    const chimeTime = !window.Cypress ? 1000 * 90 : 1000 * 6; // Play chime every 90 seconds, or every 6 seconds in Cypress
    const chimeInterval = setInterval(playChime, chimeTime);
    return () => clearInterval(chimeInterval);
  }, [launched]);

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

  return (
    <ReactCountdown
      date={localLaunchDate}
      renderer={renderTimer}
      onComplete={() => setLaunched(true)}
      overtime
    />
  );
}
