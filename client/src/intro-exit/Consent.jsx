/*
This consent includes:
- generic platform consent
- additional batch-specific language from the batch config file
*/

import React, { useEffect } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { useGlobal } from "@empirica/core/player/react";
import { Markdown } from "../components/Markdown";
import { Button } from "../components/Button";
import { H1 } from "../components/TextStyles";
import { usePermalink, useText } from "../components/utils";

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
Your platform-assigned payment ID number will be stored 
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
  complyGDPR_UK: `
All data will be managed in accordance with Data Protection Act 2018 and the 
UK General Data Protection Regulation (UK GDPR).
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

const platformConsentUS = [
  "about",
  "releaseAnonymizedData",
  "storePlatformID",
  "recordVideo",
  "showVideoToCoders",
  "shareVideoWithResearchers",
  "storeVideoIndefinitely",
  "storeWebsiteInteractions",
  "upennContact",
];

const platformConsentUK = [
  "about",
  "releaseAnonymizedData",
  "storePlatformID",
  "recordVideo",
  "showVideoToCoders",
  "shareVideoWithResearchers",
  "storeVideoUntilPublicationPlusOneYear",
  "complyGDPR_UK",
  "storeWebsiteInteractions",
  "upennContact",
];

export function Consent({ next }) {
  const player = usePlayer();
  const globals = useGlobal();
  const batchConfig = globals?.get("recruitingBatchConfig");
  const consentAddendumPath = batchConfig?.consentAddendum;

  const consentAddendum = useText({ file: consentAddendumPath });
  const consentAddendumPermalink = usePermalink(consentAddendumPath);

  const consentItems = [];
  if (
    batchConfig &&
    (batchConfig?.platformConsent === "US" || !batchConfig.platformConsent)
  )
    consentItems.push(...platformConsentUS); // US is default if not specified
  if (batchConfig?.platformConsent === "UK")
    consentItems.push(...platformConsentUK);

  useEffect(() => {
    const participantData = player?.get("participantData");
    console.log("Intro: Consent");
    console.log(`DeliberationId: ${participantData?.deliberationId}`);
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();

    player.set("viewerInfo", {
      width: window?.screen?.availWidth,
      height: window?.screen?.availHeight,
      userAgent: window?.navigator?.userAgent,
    });

    player.set("consent", [
      ...consentItems,
      consentAddendumPermalink || "noAddendum",
      "agree18Understand",
    ]);
    next();
  };

  if (!batchConfig || (consentAddendumPath && !consentAddendum)) {
    return <H1>⏳ Loading Consent Document</H1>;
  }

  return (
    <div className="grid justify-center p-5">
      <H1>✅ Informed Consent</H1>
      {consentItems.map((item) => (
        <Markdown text={consentStatements[item]} key={item} />
      ))}
      <Markdown text={consentAddendum} />
      <Markdown text={consentStatements.agree18Understand} />
      <br />
      <div className="w-auto">
        <Button handleClick={handleSubmit} testId="consentButton">
          I AGREE
        </Button>
      </div>
    </div>
  );
}
