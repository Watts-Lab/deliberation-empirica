/*
Debrief page:
States research purpose, includes CSSLab contact information
*/

import React, { useEffect } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Loading } from "@empirica/core/player/react";
import { Markdown } from "../components/Markdown";
import { useIdleContext } from "../components/IdleProvider";

export function Debrief() {
  const player = usePlayer();
  const { setAllowIdle } = useIdleContext();

  useEffect(() => {
    // Set allowIdle to true when the component loads
    setAllowIdle(true);
    console.log("Set Allow Idle");

    // Reset allowIdle to false when the component unloads
    return () => {
      setAllowIdle(false);
      console.log("Clear Allow Idle");
    };
  }, [setAllowIdle]);

  if (!player) {
    return <Loading />;
  }

  const exitCodes = player.get("exitCodes");

  const debriefStatements = `
# Finished 🎉
## Thank you for participating!

${
  exitCodes &&
  exitCodes !== "none" &&
  `Please enter the following completion code on your recruitment platform:
> ${exitCodes?.complete}`
}

### About this study
_Social scientists have tested different ways to improve small group conversations, like using a facilitator, setting an agenda, or creating ground rules. While some methods work better than others, it’s challenging to know which will be the most effective. What we do know is that different types of conversations need different kinds of support._

_Instead of looking for one solution that works for all conversations, our research team is mapping out what helps each specific type of conversation. Your participation in this study provides valuable data that, combined with data from other discussions, will help us understand how the context of a discussion shapes its outcomes._

_For any additional questions, please contact the University of Pennsylvania research team by 
emailing **[deliberation-study@wharton.upenn.edu](mailto:deliberation-study@wharton.upenn.edu)**._

${
  exitCodes !== "none"
    ? `👉 After copying the payment code above, you may close this window.`
    : ""
}
  `;
  return (
    <div className="grid justify-center">
      <Markdown text={debriefStatements} />
    </div>
  );
}
