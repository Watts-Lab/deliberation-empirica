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

function message() {
  const player = usePlayer();

  if (player && player.get("playerComplete") === true) {
    console.log("NoGames: complete");
    const exitCodeStem = player.get("exitCodeStem");
    const completeMessage = `
## 🎉 Thank you for participating!
${
  exitCodeStem !== "none"
    ? `Please enter code **${exitCodeStem}200** to be compensated for your time.`
    : ""
}

The experiment is now finished.

We release studies on a regular basis, and we hope that you will have the opportunity to participate again soon.
    `;

    return <Markdown text={completeMessage} />;
  }

  if (player) {
    console.log("NoGames: error");
    const exitCodeStem = player.get("exitCodeStem");
    const failureMessage = `
## 😬 Server error
We are sorry, your study has unexpectedly stopped. 

${
  exitCodeStem !== "none"
    ? `Please enter code **${exitCodeStem}500** to be compensated for your time.`
    : ""
}

We hope you can join us in a future study.
    `;
    return <Markdown text={failureMessage} />;
  }

  const noExperimentsMessage = `
## ⏳ There are no studies available at this time.

We release studies on a regular basis, and we hope that you will have the opportunity to participate soon.
`;
  return <Markdown text={noExperimentsMessage} />;
}

export function NoGames() {
  return <div className="grid h-screen place-items-center">{message()}</div>;
}
