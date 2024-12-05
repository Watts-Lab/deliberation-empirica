import { usePlayer } from "@empirica/core/player/classic/react";
import React from "react";
import { Markdown } from "../components/Markdown";

const completeMessage = `
## 🎉 Thank you for participating!
The experiment is now finished.
Please enter the following code to be compensated for your time:
> `;

const closedMessage = `
## 🥱 The experiment is now closed.
We release studies on a regular basis, and we hope that you will have the opportunity to participate soon.
`;

const noExperimentsMessage = `
## ⏳ There are no studies available at this time.
We release studies on a regular basis, and we hope that you will have the opportunity to participate soon.
`;

export function NoGames() {
  const player = usePlayer();

  let message;
  if (player && player.get("playerComplete") === true) {
    /*
    You have completed the game, 
    and are seeing the exit code after the batch has been terminated.
    */
    message = completeMessage;
    const exitCodes = player?.get("exitCodes");
    if (exitCodes !== undefined && exitCodes !== "none") {
      message += exitCodes.complete;
    }
  } else if (player) {
    /*
    If a player object exists, but you haven't completed the game,
    you completed registration but didn't finish before we terminated.
    Probably you left.
    */
    message = closedMessage;
  } else {
    /* 
    The batch closed before you registered, 
    i.e. there are no experiments available to join.
    */
    message = noExperimentsMessage;
  }

  return (
    <div className="grid h-screen place-items-center">
      <Markdown text={message} />
    </div>
  );
}
