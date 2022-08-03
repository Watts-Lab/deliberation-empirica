import React, { useEffect } from 'react';
import { Consent } from '@empirica/player';

const consentText = (
  <div className="grow">
    <p>
      → This activity is part of a scientific experiment to understand the process&nbsp;
      of group deliberation. Your participation in this study is entirely voluntary,&nbsp;
      and&nbsp;
      <strong>you may withdraw at any point by closing this browser window</strong>
      .
    </p>
    <p>
      → During this activity, you may engage in video, audio, or text chat with other&nbsp;
      study participants. You may be shown instructional material, asked to discuss&nbsp;
      particular topics, and complete surveys about your experience.&nbsp;
      <strong> We may record your discussion for quality control and analysis. </strong>
      These recordings will be kept secure and confidential.&nbsp;
      We may share recordings under a confidentiality agreement&nbsp;
      with researchers who specialize in video or audio analysis.
    </p>
    <p>
      → Apart from these recordings,&nbsp;
      the only information we will have is your platform-assigned payment ID&nbsp;
      (e.g. MTurk worker ID) and the timestamps of your interactions with our site.&nbsp;
      We will record this ID to allow us to observe participation across sessions.&nbsp;
      There is no way for us to identify you or contact you outside of the crowd-sourcing&nbsp;
      platform through which you joined.
    </p>
    <p>
      →&nbsp;
      <strong>Anonymous data (not including discussion recordings) may be shared publicly. </strong>
      Our aggregate results may be presented at scientific meetings or&nbsp;
      published in scientific journals.
    </p>
    <p>
      → You can contact the research team by emailing&nbsp;
      <a href="mailto:deliberation-study@wharton.upenn.edu"> deliberation-study@wharton.upenn.edu</a>
      .&nbsp;
      You can call the University of Pennsylvania Institutional Review Board at 215-898-2614.
    </p>
    <br />
    <p>
      Clicking on the &quot;I AGREE&quot; button indicates that you are at least 18 years of age,
      &nbsp;understand this agreement, and consent to participate voluntarily
    </p>
  </div>
);

export function IRBConsent({ onConsent }) {
  useEffect(() => {
    console.log('Intro: Consent');
  }, []);

  return (
    <Consent
      onConsent={onConsent}
      title="Informed Consent"
      text={consentText}
      buttonText="I AGREE"
    />
  );
}
