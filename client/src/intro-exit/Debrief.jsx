/*
Debrief page:
States research purpose, includes CSSLab contact information

TO DO: include email hyperlink at the bottom
*/

import React from "react";
import { Markdown } from "../components/Markdown";

const debriefStatements = `
# Thank you for participating! 🙂

Please enter completion code **CptTurk1NDSO32** into the appropriate box on your recruitment platform.

### About this study
_Social scientists have tried many things to improve small group conversations, such as 
facilitation, agenda setting, or establishing ground rules. 
Some of these methods work better than others, but its hard to know which ones will be the most effective. 
One thing we know for certain is that different types of discussions benefit from different types of support._

_Rather than trying to find one trick that will improve all group conversations, our research
team is trying to create a map of what is helpful for each specific type of conversation. 
Your participation in this study provides data that we will combine with data from many other 
discussions to understand how a discussion's context shapes its outcomes._

_This research will help us support groups like parent-teacher organizations or volunteer groups
in their day-to-day decision making, and will support work to promote civility and understanding between groups._

_For any additional questions, please contact the University of Pennsylvania research team by 
emailing **[deliberation-study@wharton.upenn.edu](mailto:deliberation-study@wharton.upenn.edu)**._
`;

export function Debrief() {
  return (
    <div className="grid justify-center">
      <Markdown text={debriefStatements} />
    </div>
  );
}
