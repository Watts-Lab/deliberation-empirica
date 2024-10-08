/*
Debrief page:
States research purpose, includes CSSLab contact information
*/

import React from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Loading } from "@empirica/core/player/react";
import { Markdown } from "../components/Markdown";

export function Debrief() {
  const player = usePlayer();

  if (!player) {
    return <Loading />;
  }

  const exitCodes = player.get("exitCodes");

  const debriefStatements = `
# Finished 🎉
## Thank you for participating!

${
  exitCodes !== "none"
    ? `Please enter completion code **${exitCodes.complete}** into the appropriate box on your recruitment platform.`
    : ""
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
