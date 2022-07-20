import React, {useRef, useEffect} from "react";
import { Consent } from '@empirica/player';

const consentText = 
   <div>
    <p>→This activity is part of a scientific experiment to understand the process 
    of group deliberation. Your participation in this study is entirely voluntary, 
    and <strong>you may withdraw at any point by closing this browser window</strong>.</p> 
    <p>→During this activity, you may engage in video, audio, or text chat with other 
    study participants. You may be shown instructional material, asked to discuss 
    particular topics, and complete surveys about your experience. 
    <strong> We may record your discussion for quality control and analysis. </strong> 
    These recordings will be kept secure and confidential. 
    We may share recordings under a confidentiality agreement 
    with researchers who specialize in video or audio analysis. </p>
    <p>→Apart from these recordings, 
    the only information we will have is your platform-assigned payment ID 
    (e.g. MTurk worker ID) and the timestamps of your interactions with our site. 
    We will record this ID to allow us to observe participation across sessions. 
    There is no way for us to identify you or contact you outside of the crowd-sourcing 
    platform through which you joined.</p> 
    <p>→<strong>Anonymous data (not including discussion recordings) 
    may be shared publicly.</strong> Our aggregate results may be presented at scientific meetings or 
    published in scientific journals.</p> 
    <p>→You can contact the research team by emailing 
    <a href="mailto:deliberation-study@wharton.upenn.edu"> deliberation-study@wharton.upenn.edu</a>. 
    You can call the University of Pennsylvania Institutional Review Board at 215-898-2614.</p> 
    <br/>
    <p>Clicking on the "I AGREE" button indicates that you are at least 18 years of age, 
    understand this agreement, and consent to participate voluntarily'</p>

   </div>
   

export function IRBConsent({ onConsent }) {
  useEffect(() => {
      console.log("Intro: Consent")
  }, []);

  return(
    <Consent 
      onConsent={onConsent} 
      title="Informed Consent" 
      text={consentText} 
      buttonText="I AGREE" />
  );
}