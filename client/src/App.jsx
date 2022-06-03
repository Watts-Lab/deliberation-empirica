import { EmpiricaMenu, EmpiricaPlayer, GameFrame } from "@empirica/player";
import React from "react";
import "virtual:windi.css";
import { Game } from "./Game";
import { ExitSurvey } from "./intro-exit/ExitSurvey";
import ExampleExitSurvey from './intro-exit/Surveys/ExampleExitSurvey';
import { Introduction } from "./intro-exit/Introduction";
import { EnterNickname } from "./intro-exit/EnterNickname";
import { CheckUnderstanding } from "./intro-exit/CheckUnderstanding";
import VideoCheck from "./intro-exit/VideoCheck";
import { usePlayer } from "@empirica/player";
import { Consent } from '@empirica/player';
import { PlayerIDForm } from './intro-exit/PlayerIDForm';


export function getURL() {
  // helps resolve some issues with running from the localhost over ngrok
  const host = window.location.hostname;
  
  if (host === "localhost") {
    return "http://localhost:3000/query";
  }

  return "https://" + host + "/query";
}

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const playerKey = urlParams.get("playerKey") || "";

  const introSteps = [
    Introduction, 
    (args) => EnterNickname({...args, usePlayer}), 
    (args) => VideoCheck({...args, usePlayer}), 
    CheckUnderstanding
  ]

  const exitSteps = [
    ExampleExitSurvey
  ]

  const consentText = 'This activity is part of a scientific experiment to understand the process of group deliberation. Your participation in this study is entirely voluntary, and you may withdraw at any point by closing this browser window. During this activity, you may engage in video, audio, or text chat with other study participants. You may be shown instructional material, asked to discuss particular topics, and complete surveys about your experience. We may record your discussion for quality control and analysis. These recordings will be kept secure and confidential. We may share recordings under a confidentiality agreement with researchers who specialize in video or audio analysis. Apart from these recordings, the only information we will have is your platform-assigned payment ID (e.g. MTurk worker ID) and the timestamps of your interactions with our site. We will record this ID to allow us to observe participation across sessions. There is no way for us to identify you or contact you outside of the crowd-sourcing platform through which you joined. Anonymous data (not including discussion recordings) may be shared publicly. Our aggregate results may be presented at scientific meetings or published in scientific journals. You can contact the research team by emailing deliberation-study@wharton.upenn.edu. You can call the University of Pennsylvania Institutional Review Board at 215-898-2614. Clicking on the "I AGREE" button indicates that you are at least 18 years of age, understand this agreement, and consent to participate voluntarily'

  function MyCustomConsent({ onConsent }) {
    return(<Consent onConsent={onConsent} title="Informed Consent" text={consentText} buttonText="I AGREE" />);
  }

  // const player = usePlayer()
  // console.log("In App, player is:" + player) # player is null! Can't get it here...
  return (
    <div className="h-screen relative">
      <EmpiricaMenu />
      <div className="h-full overflow-auto">
        <EmpiricaPlayer url={getURL()} ns={playerKey}>
          <GameFrame 
            consent={MyCustomConsent}
            playerIDForm={PlayerIDForm}
            introSteps={introSteps} 
            exitSteps={exitSteps}>
            <Game />
          </GameFrame>
        </EmpiricaPlayer>
      </div>
    </div>
  );
}
