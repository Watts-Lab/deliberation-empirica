/*
Debrief page:
States research purpose, includes CSSLab contact information

TO DO: include email hyperlink at the bottom
*/

import React from "react";
import { Markdown } from "../components/Markdown";

const debriefStatements = `
# Thank you for participating! 🙂

**We will use the completion code you submitted earlier to
pay your bonus for the rest of the experiment - you don't need to do
anything else.** 

### About this study
Social scientists have tried many things to improve small group conversations, such as 
having a facilitator, setting a clear agenda, or establishing ground rules for the discussion. 
Some of these methods work better than others, but its hard to know which ones will be the most effective. 
One thing we know for certain is that different types of discussions benefit from different types of support.

Rather than trying to find one trick that will improve all group conversations, our research
team is trying to create a map of what is helpful for each specific type of conversation. 
Your participation in this study provides data that we will combine with data from many other 
discussions to understand how a discussion's context shapes its outcomes.

Down the road, this research will help us support groups like parent-teacher organizations or volunteer groups
in their day-to-day decision making, and will support work to promote civility and understanding between groups.

For any additional questions, please contact the University of Pennsylvania research team by 
emailing [deliberation-study@wharton.upenn.edu](mailto:deliberation-study@wharton.upenn.edu).

check me out at [example.com](example.com)
`;

export function Debrief() {
  return (
    <div className="grid justify-center">
      <Markdown text={debriefStatements} />
    </div>
  );
}
