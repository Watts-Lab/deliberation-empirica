import { EmpiricaMenu, EmpiricaPlayer, GameFrame } from "@empirica/player";
import React from "react";
import "virtual:windi.css";
import { Game } from "./Game";
import IntroCheck from "./intro-exit/IntroCheck";
import { EnterNickname } from "./intro-exit/EnterNickname";
import VideoCheck from "./intro-exit/VideoCheck";
import { usePlayer, useGame, useStage, useRound } from "@empirica/player";
import TopicSurvey from "./intro-exit/Surveys/gov_reduce_income_inequality";
import team_viability from "./intro-exit/Surveys/team_viability";
import quality_control from "./intro-exit/Surveys/quality_control";
import { isMobile } from "react-device-detect";
import { Alert } from "./components/Alert";
import { PlayerIDForm } from './intro-exit/PlayerIDForm';
import { NoGamesWithSorry } from "./pages/NoGamesWithSorry"
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
  const secondaryPlayerKey = urlParams.get("secondaryPlayerKey") || "";
  const multiplayer = urlParams.get("multiplayer") || false;
  // const [multiPlayer, setMultiPlayer] = React.useState(window.Cypress ? false : true);

  const introSteps = [
    IntroCheck, 
    (args) => EnterNickname({...args, usePlayer}), 
    (args) => VideoCheck({...args, usePlayer})
  ]

  const exitSteps = [
    team_viability,
    quality_control
  ]

  // const player = usePlayer()
  // console.log("In App, player is:" + player) # player is null! Can't get it here...
  if (isMobile) {
    return (
      <div className="h-screen relative mx-2 my-5">
        <Alert kind="error" title="ERROR: Mobile Device Detected" children="Mobile devices are not supported. Please join again from a computer to participate."/>
      </div>
    );
  }

  return (
    <div className="h-screen relative">
      <EmpiricaMenu />
      <div className="h-full overflow-auto">
        <div test-player-id="player1">
          <EmpiricaPlayer url={getURL()} ns={playerKey}>
            <GameFrame
              consent={IRBConsent} 
              playerIDForm={PlayerIDForm}
              introSteps={introSteps} 
              exitSteps={exitSteps}
              noGames={NoGamesWithSorry}>
              <Game />
            </GameFrame>
          </EmpiricaPlayer>
        </div>
        <div test-player-id="player2">
          {multiplayer && <EmpiricaPlayer url={getURL()} ns={secondaryPlayerKey}>
            <GameFrame
              consent={IRBConsent} 
              playerIDForm={PlayerIDForm}
              introSteps={introSteps} 
              exitSteps={exitSteps}
              noGames={NoGamesWithSorry}>
              <Game />
            </GameFrame>
          </EmpiricaPlayer>}
        </div>
      </div>
    </div>
  );
}