import { EmpiricaMenu, EmpiricaPlayer, GameFrame } from "@empirica/player";
import React from "react";
import "virtual:windi.css";
import { Game } from "./Game";
import { ExitSurvey } from "./intro-exit/ExitSurvey";
import ExampleExitSurvey from './intro-exit/Surveys/ExampleExitSurvey';
import IntroCheck from "./intro-exit/IntroCheck";
import { EnterNickname } from "./intro-exit/EnterNickname";
import { CheckUnderstanding } from "./intro-exit/CheckUnderstanding";
import VideoCheck from "./intro-exit/VideoCheck";
import { usePlayer } from "@empirica/player";
import TopicSurvey from "./intro-exit/Surveys/gov_reduce_income_inequality";
import team_viability from "./intro-exit/Surveys/team_viability";
import quality_control from "./intro-exit/Surveys/quality_control";

import { IRBConsent } from './intro-exit/IRBConsent';

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
    IntroCheck, 
    (args) => EnterNickname({...args, usePlayer}), 
    (args) => VideoCheck({...args, usePlayer}), 
    TopicSurvey
  ]

  const exitSteps = [
    team_viability,
    quality_control
  ]

  // const player = usePlayer()
  // console.log("In App, player is:" + player) # player is null! Can't get it here...
  return (
    <div className="h-screen relative">
      <EmpiricaMenu />
      <div className="h-full overflow-auto">
        <EmpiricaPlayer url={getURL()} ns={playerKey}>
          <GameFrame
            consent={IRBConsent} 
            introSteps={introSteps} 
            exitSteps={exitSteps}>
            <Game />
          </GameFrame>
        </EmpiricaPlayer>
      </div>
    </div>
  );
}
