/*
Countdown.jsx
@jamesphoughton
Used for synchronizing participants. Goes after intro steps, just before lobby.
- [ ] Sends a code to the recruitment platform saying that recruitment steps are complete.
- [ ] Tells the participant that they have been paid for the intro steps.
- [x] displays a time for the participants how long they need to wait.
- [x] sounds a chime when its time to start
- [x] gives a button "I'm still here, please proceed at the launch time"

*/
import React, { useEffect } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { default as ReactCountdown, zeroPad } from "react-countdown";
import { H1, H3, H4, P } from "../components/TextStyles";
import { Button } from "../components/Button";

//TODO: guard against client side clock errors

export function Countdown({ next }) {
  useEffect(() => {
    console.log("Intro: Countdown");
  }, []);

  const player = usePlayer();
  const chime = new Audio("westminster_quarters.mp3");

  const launchDate = Date.parse(player.get("treatment").launchDate);

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
      <H3>Thanks for signing up!</H3>
      <H4>Your completion code for signing up is: HJSDNWONS</H4>
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

  return (
    <ReactCountdown
      date={launchDate}
      renderer={renderTimer}
      onComplete={() => chime.play()}
      overtime
    />
  );
}
