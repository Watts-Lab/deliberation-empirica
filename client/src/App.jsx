import { EmpiricaMenu, EmpiricaPlayer, GameFrame } from "@empirica/player";
import React from "react";
import "virtual:windi.css";
import { Game } from "./Game";
import { ExitSurvey } from "./intro-exit/ExitSurvey";
import ExampleExitSurvey from './intro-exit/Surveys/ExampleExitSurvey';
import { Introduction } from "./intro-exit/Introduction";
import VideoCheck from "./intro-exit/VideoCheck";

import { usePlayer } from "@empirica/player";


export function getURL() {
  const host = window.location.hostname;
  
  if (host === "localhost") {
    return "http://localhost:3000/query";
  }

  return "https://" + host + "/query";
}

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const playerKey = urlParams.get("playerKey") || "";

  // const player = usePlayer()
  // console.log("In App, player is:" + player) # player is null! Can't get it here...
  return (
    <div className="h-screen relative">
      <EmpiricaMenu />
      <div className="h-full overflow-auto">
        <EmpiricaPlayer url={getURL()} ns={playerKey}>
          <GameFrame 
            introSteps={[Introduction, (args) => VideoCheck({...args, usePlayer})]} 
            exitSteps={[ExampleExitSurvey]
          }>
            <Game />
          </GameFrame>
        </EmpiricaPlayer>
      </div>
    </div>
  );
}
