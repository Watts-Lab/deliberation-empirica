import { EmpiricaMenu, EmpiricaPlayer, GameFrame } from "@empirica/player";
import React from "react";
import "virtual:windi.css";
import { Game } from "./Game";
import { ExitSurvey } from "./intro-exit/ExitSurvey";
import ExampleExitSurvey from './intro-exit/Surveys/ExampleExitSurvey';
import { Introduction } from "./intro-exit/Introduction";
<<<<<<< HEAD
import teamViability from "./intro-exit/Surveys/teamViability";
import QCSurvey from "./intro-exit/Surveys/QCSurvey";
=======
import { EnterNickname } from "./intro-exit/EnterNickname";
import { CheckUnderstanding } from "./intro-exit/CheckUnderstanding";
import VideoCheck from "./intro-exit/VideoCheck";
import { usePlayer } from "@empirica/player";

>>>>>>> main

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

  // const player = usePlayer()
  // console.log("In App, player is:" + player) # player is null! Can't get it here...
  return (
    <div className="h-screen relative">
      <EmpiricaMenu />
      <div className="h-full overflow-auto">
        <EmpiricaPlayer url={getURL()} ns={playerKey}>
<<<<<<< HEAD
          <GameFrame introSteps={[Introduction]} exitSteps={[teamViability, QCSurvey]}>
=======
          <GameFrame 
            introSteps={introSteps} 
            exitSteps={exitSteps}>
>>>>>>> main
            <Game />
          </GameFrame>
        </EmpiricaPlayer>
      </div>
    </div>
  );
}
