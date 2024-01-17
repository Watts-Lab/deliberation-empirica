/*
Countdown.jsx
James Houghton
Used for synchronizing participants. Goes after intro steps, just before lobby.

*/
import React, { useEffect, useState } from "react";
import { default as ReactCountdown, zeroPad } from "react-countdown";
import { usePlayer } from "@empirica/core/player/classic/react";
import { H1, P } from "../components/TextStyles";
import { Button } from "../components/Button";
import { ConfirmLeave } from "../components/ConfirmLeave";

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
      <H1>The study is ready to begin.</H1>
      <Button testId="proceedButton" id="proceed" handleClick={next}>
        Proceed
      </Button>
      <P>
        The study has been live for {zeroPad(hours)}:{zeroPad(minutes)}:
        {zeroPad(seconds)}
      </P>
    </div>
  );

  const renderWait = ({ hours, minutes, seconds }) => (
    <div className="text-center">
      <H1>Keep this window open</H1>
      <P>Thanks for completing the qualification steps.</P>
      <H1>
        The study begins in {zeroPad(hours)}:{zeroPad(minutes)}:
        {zeroPad(seconds)}
      </H1>
      <H1>
        Keep this window open. You will be redirected to the study when it
        begins.
      </H1>
      <P>Feel free to work on other things in the meantime.</P>
      <P>We will sound a chime when the study begins.</P>
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
    <>
      <ConfirmLeave />
      <ReactCountdown
        date={localLaunchDate}
        renderer={renderTimer}
        onComplete={playChime}
        overtime
      />
    </>
  );
}
