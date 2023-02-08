/*
This consent includes:
- generic platform consent
- additional batch-specific language from the batch config file
*/

import React, { useEffect } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Markdown } from "../components/Markdown";
import { Button } from "../components/Button";
import { H1 } from "../components/TextStyles";

const consentStatements = {
  about: `
This activity is part of a scientific experiment to understand small group discussions. 
Your participation in this study is entirely voluntary, and you may withdraw 
at any point by closing this browser window.

In this study, you may be asked to answer survey questions, watch training videos, and
discuss a provided topic in a **live video call with other participants**.
    `,
  releaseAnonymizedData: `
After the session, anonymized data will be shared in academic publications, 
scientific conferences, and publicly-accessible scientific data repositories.
    `,
  storePlatformID: `
Your platform-assigned payment ID number (e.g. MTurk worker ID) will be stored 
on a secure and confidential server. We will use this ID to ensure proper 
payment and to observe participation across multiple study sessions.
    `,
  recordVideo: `
**Your discussions will be recorded** for quality control and analysis.
    `,
  showVideoToCoders: `
Discussion recordings may be displayed to workers we train to analyze and 
annotate them.
    `,
  shareVideoWithResearchers: `
Discussion recordings may be shared under a confidentiality agreement with 
other researchers.
    `,
  storeVideoIndefinitely: `
Discussion recordings will be stored indefinitely on a secure and confidential 
server.
    `,
  storeVideoUntilPublicationPlusOneYear: `
Discussion recordings will be stored on a secure and confidential server 
for up to one year after the publication of results in an academic journal.
    `,
  storeWebsiteInteractions: `
The only other information we will have is your interactions with this website. 
There is no way for us to identify you or contact you outside of the recruitment 
platform through which you joined.
    `,
  upennContact: `
You can contact the University of Pennsylvania research team by emailing
deliberation-study@wharton.upenn.edu. You can call the University of Pennsylvania
Institutional Review Board at 215-898-2614.
    `,
  agree18Understand: `
Clicking on the "I AGREE" button indicates that you are at least 18 years of age, 
understand this agreement, and consent to participate voluntarily.
    `,
};

const defaultConsentItems = [
  "about",
  "releaseAnonymizedData",
  "storePlatformID",
  "recordVideo",
  "showVideoToCoders",
  "shareVideoWithResearchers",
  "storeVideoIndefinitely",
  "storeWebsiteInteractions",
  "upennContact",
  "agree18Understand",
];

export function Consent({ next }) {
  const player = usePlayer();

  // Todo: update this with modifications from the
  const consentItems = defaultConsentItems;

  useEffect(() => {
    console.log("Intro: Consent");
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    player.set("consent", consentItems);
    console.log(`Consent items`, consentItems);
    next();
  }

  return (
    <div className="grid justify-center">
      <H1>✅ Informed Consent</H1>
      {consentItems.map((item) => (
        <Markdown text={consentStatements[item]} />
      ))}
      <br />
      <div className="w-auto">
        <Button handleClick={handleSubmit} testId="consentButton">
          I AGREE
        </Button>
      </div>
    </div>
  );
}
