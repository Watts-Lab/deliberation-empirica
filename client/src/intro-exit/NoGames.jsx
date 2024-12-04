/* 
NoGames.jsx
James Houghton

If you arrive here without a player object assigned, 
it means that this was prior to the player registration screen, 
and so there are no experiments available for the player to join.

If you arrive here with a player object assigned,
it happened after the player registration (ie, you've done some work)
but prior to entering the game. (Ie, there should be no game object at this point)

*/

import { usePlayer } from "@empirica/core/player/classic/react";
import React from "react";
import { Markdown } from "../components/Markdown";

const completeMessage = `
## 🎉 Thank you for participating!
The experiment is now finished.
Please enter the following code to be compensated for your time:
> 
`;

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
  const exitCodes = player?.get("exitCodes");

  let message;
  if (player && player.get("playerComplete") === true) {
    message = completeMessage;
    if (exitCodes !== undefined && exitCodes !== "none") {
      message += exitCodes.complete;
    }
  } else if (player) {
    message = closedMessage;
  } else {
    message = noExperimentsMessage;
  }

  return (
    <div className="grid h-screen place-items-center">
      <Markdown text={message} />
    </div>
  );
}
