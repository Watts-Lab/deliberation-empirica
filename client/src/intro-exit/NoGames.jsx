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
## No experiments available

There are currently no available experiments. 
Please wait until an experiment becomes available or come back at a later date.
`;

const introStepFailureMessage = `
## Technical failure
We are sorry, your experiment has unexpectedly stopped. 
You will be compensated for your time.
We hope you can join us in a future experiment!
`;

export function NoGames() {
  const player = usePlayer();
  useEffect(() => {
    console.log(
      player ? "Page: Intro step failure" : "Page: No games available"
    );
  }, []);

  return (
    <div className="text-justify items-center justify-center">
      <Markdown
        text={player ? introStepFailureMessage : noExperimentsMessage}
      />
    </div>
  );
}
