/*
Countdown.jsx
James Houghton
Used for synchronizing participants. Goes after intro steps, just before lobby.
- [ ] Sends a code to the recruitment platform saying that recruitment steps are complete.
- [ ] Tells the participant that they have been paid for the intro steps.
- [x] displays a time for the participants how long they need to wait.
- [x] sounds a chime when its time to start
- [x] gives a button "I'm still here, please proceed at the launch time"

*/
import React, { useEffect, useState } from "react";
import { default as ReactCountdown, zeroPad } from "react-countdown";
import { usePlayer } from "@empirica/core/player/classic/react";
import { H1, P } from "../components/TextStyles";
import { Button } from "../components/Button";

// TODO: guard against client side clock errors

export function Countdown({ launchDate, next }) {
  const chime = new Audio("westminster_quarters.mp3");
  const player = usePlayer();
  const [hasPlayed, setHasPlayed] = useState(false);

  useEffect(() => {
    if (!player.get("inCountdown")) {
      player.set("inCountdown", true);
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
    <ReactCountdown
      date={launchDate}
      renderer={renderTimer}
      onComplete={playChime}
      overtime
    />
  );
}
