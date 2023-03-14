/*
Debrief page:
States research purpose, includes CSSLab contact information

TO DO: include email hyperlink at the bottom
*/

import React from "react";
// import { usePlayer } from "@empirica/core/player/classic/react";
// import { useGlobal } from "@empirica/core/player/react";
import { Markdown } from "../components/Markdown";
// import { Button } from "../components/Button";
import { H1 } from "../components/TextStyles";
// import { usePermalink, useText } from "../components/utils";


const debriefStatements = `
Thank you for participating. There is no need to submit additional payment information.

The overall objective of the research program is to discover **which interventions most
reduce social polarization in deliberative groups and populations**. Prior research on
deliberation has identified many features – of individual participants, the circumstances under
which they come together, and the topics they consider – that are potentially relevant to the
success of a given deliberative exercise. Unfortunately, the current state of research does not
provide clear guidelines for how these features influence the process of deliberation. As a
result, we have trouble using our existing knowledge to predict which interventions are most
likely to succeed in a given situation.

Additionally, the generalizability crisis in social science – where research results are difficult to 
generalize beyond the study – means that it is essentially impossible to make “apples to apples” comparisons
across different contexts. 

The Computational Social Science Lab at the University of Pennsylvania is working to address
the generalizability problem by rethinking how empirical studies of deliberation are conducted
and aggregated. Our long-run goal is twofold: first, to build an open-science platform that
facilitates what we call “high-throughput experiment design”; and second, to organize a
community of researchers and practitioners around this platform to efficiently explore the
space of possible experimental contexts, and ultimately to build replicable, cumulative, and
useful knowledge. 

For any additional questions, please contact the University of Pennsylvania research team by emailing deliberation-study@wharton.upenn.edu.
`

export function Debrief() {
    return (
        <div className="grid justify-center">
          <H1>Finished</H1>
            <Markdown text={debriefStatements} />
        </div>
      );
}