/* 
NoGames.jsx
@jamesphoughton

If you arrive here without a player object assigned, 
it means that this was prior to the player registration screen, 
and so there are no experiments available for the player to join.

If you arrive here with a player object assigned,
it happened after the player registration (ie, you've done some work)
but prior to entering the game. (Ie, there should be no game object at this point)

*/

import { usePlayer } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";
import { Markdown } from "../components/Markdown";

const noExperimentsMessage = `
## ⏳ There are no studies available at this time.

We release studies on a regular basis, and we hope that you will have the opportunity to participate soon.
`;

const failureMessage = `
## 😬 Server error
We are sorry, your study has unexpectedly stopped. 

You will be compensated for your time.

We hope you can join us in a future study.
`;

const gameDone = `
## 🥳 Thanks for participating!

The study is now over.
`;

function message() {
  const player = usePlayer();

  if (player && player.get("gameDone") === true) {
    console.log("NoGames: complete");
    return <Markdown text={gameDone} />;
  }

  if (player) {
    console.log("NoGames: error");
    return <Markdown text={failureMessage} />;
  }

  return <Markdown text={noExperimentsMessage} />;
}

export function NoGames() {
  return <div className="grid h-screen place-items-center">{message()}</div>;
}
