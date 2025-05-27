/*
This consent includes:
- generic platform consent
- additional batch-specific language from the batch config file
*/

import React, { useEffect, useState } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { useGlobal } from "@empirica/core/player/react";
import { Markdown } from "../components/Markdown";
import { Button } from "../components/Button";
import { useConnectionInfo, usePermalink, useText } from "../components/hooks";

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

  custom: "",
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
  const connectionInfo = useConnectionInfo();
  const [loadedTime, setLoadedTime] = useState(-1);
  const batchConfig = globals?.get("recruitingBatchConfig");

  const consentAddendumPath =
    batchConfig && batchConfig.consentAddendum !== "none"
      ? batchConfig?.consentAddendum
      : null;

  const { text: consentAddendum } = useText({ file: consentAddendumPath });
  const consentAddendumPermalink = usePermalink(consentAddendumPath);

  const consentItems = [];
  if (
    batchConfig &&
    (batchConfig?.platformConsent === "US" || !batchConfig.platformConsent)
  )
    consentItems.push(...platformConsentUS); // US is default if not specified
  if (batchConfig?.platformConsent === "UK")
    consentItems.push(...platformConsentUK);

  if (batchConfig?.platformConsent === "custom") consentItems.push("custom");

  useEffect(() => {
    const participantData = player?.get("participantData");
    console.log("Intro: Consent");
    console.log(`DeliberationId: ${participantData?.deliberationId}`);
    setLoadedTime(Date.now());
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();

    // collect info on user session
    const browserInfo = {
      screenWidth: window?.screen?.availWidth,
      screenHeight: window?.screen?.availHeight,
      width: window?.innerWidth,
      height: window?.innerHeight,
      userAgent: window?.navigator?.userAgent,
      language: window?.navigator?.language,
      timezone: window?.Intl?.DateTimeFormat().resolvedOptions().timeZone,
      referrer: document?.referrer,
    };

    player.set("browserInfo", browserInfo);

    const urlParams = new URLSearchParams(window.location.search);
    const paramsObj = Object.fromEntries(urlParams?.entries());
    player.set("urlParams", paramsObj);

    connectionInfo.isLikelyVpn =
      connectionInfo?.isKnownVpn ||
      connectionInfo?.timezone !== browserInfo?.timezone;
    connectionInfo.effectiveType = navigator?.connection?.effectiveType;
    connectionInfo.saveData = navigator?.connection?.saveData; // The saveData read-only property of the NetworkInformation interface returns true if the user has set a reduced data usage option on the user agent.
    connectionInfo.downlink = navigator?.connection?.downlink;
    connectionInfo.rtt = navigator?.connection?.rtt;

    player.set("connectionInfo", connectionInfo);

    player.set("consent", [
      ...consentItems,
      consentAddendumPermalink || "noAddendum",
      "agree18Understand",
    ]);

    const elapsed = (Date.now() - loadedTime) / 1000;
    player.set(`duration_consent`, { time: elapsed });
    next();
  };

  if (!batchConfig || (consentAddendumPath && !consentAddendum)) {
    return <h1>⏳ Loading Consent Document</h1>;
  }

  return (
    <div className="grid justify-center p-5">
      <h1>✅ Informed Consent</h1>
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
