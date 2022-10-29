import { EmpiricaClassic } from "@empirica/core/player/classic";
import { EmpiricaContext } from "@empirica/core/player/classic/react";
import { EmpiricaParticipant } from "@empirica/core/player/react";
import React, { useEffect } from "react";
import { isMobile } from "react-device-detect";
import "virtual:windi.css"; // what is this => Tailwind like CSS framework https://windicss.org/
import { isDevelopment } from "@empirica/core/player";
import { Game } from "./Game";
import { IntroCheck } from "./intro-exit/IntroCheck";
import { Alert } from "./components/Alert";
import { EnterNickname } from "./intro-exit/EnterNickname";
import { IRBConsent } from "./intro-exit/IRBConsent";
import { PlayerIDForm } from "./intro-exit/PlayerIDForm";
import { ExitSurvey } from "./intro-exit/ExitSurvey";
import { qualityControl } from "./intro-exit/QualityControl";
import { VideoCheck } from "./intro-exit/VideoCheck";
import { Lobby } from "./intro-exit/Lobby";
import { NoGamesWithSorry } from "./intro-exit/NoGamesWithSorry";
import { EmpiricaMenu } from "./components/EmpiricaMenu";

export function getURL() {
  // helps resolve some issues with running from the localhost over ngrok
  // TODO: find out if we can remove this
  const host = window.location.hostname;

  if (host === "localhost") {
    return "http://localhost:3000/query";
  }

  return `https://${host}/query`;
}

// eslint-disable-next-line import/no-default-export
export default function App() {
  useEffect(() => {
    console.log(`Start: ${process.env.NODE_ENV} environment`);
  }, []);

  const urlParams = new URLSearchParams(window.location.search);
  const playerKeys = urlParams.getAll("playerKey");
  if (playerKeys.length < 1) {
    // this is a common case - most players will show up without keys in their URL
    playerKeys.push("keyless");
  }

  playerKeys.forEach((playerKey, index) => {
    console.log(`player_${index} key:`, playerKey);
  });

  // eslint-disable-next-line no-unused-vars
  function introSteps({ game, player }) {
    return [IntroCheck, EnterNickname, VideoCheck];
  }

  // eslint-disable-next-line no-unused-vars
  function exitSteps({ game, player }) {
    const exitSurveys = [];
    if (game) {
      let surveyNames = game.get("treatment").exitSurveys;
      if (!(surveyNames instanceof Array)) {
        surveyNames = [surveyNames];
      }
      surveyNames.forEach((surveyName) => {
        const exitSurvey = ({ next }) => ExitSurvey({ surveyName, next });
        exitSurveys.push(exitSurvey);
      });
    }
    exitSurveys.push(qualityControl); // always show QC survey
    return exitSurveys;
  }

  if (isMobile) {
    return (
      <div className="h-screen relative mx-2 my-5">
        <Alert kind="error" title="ERROR: Mobile Device Detected">
          Mobile devices are not supported. Please join again from a computer to
          participate.
        </Alert>
      </div>
    );
  }

  function renderPlayers(keys) {
    const players = keys.map((playerKey) => (
      <div className="p-5 pr-10" key={playerKey} test-player-id={playerKey}>
        <EmpiricaParticipant
          url={getURL()}
          ns={playerKey}
          modeFunc={EmpiricaClassic}
        >
          {isDevelopment && <EmpiricaMenu />}
          <EmpiricaContext
            consent={IRBConsent}
            playerCreate={PlayerIDForm}
            noGames={NoGamesWithSorry}
            lobby={Lobby}
            introSteps={introSteps} // eslint-disable-line react/jsx-no-bind -- empirica requirement
            exitSteps={exitSteps} // eslint-disable-line react/jsx-no-bind -- empirica requirement
          >
            <Game />
          </EmpiricaContext>
        </EmpiricaParticipant>
      </div>
    ));

    return <div className="h-full overflow-auto">{players}</div>;
  }

  return (
    <div className="h-screen relative rm-5">
      {
        // renderPlayers(['dev', 'test'].includes(game.get("deployEnvironment")) ? playerKeys : [playerKeys[0]])
        renderPlayers(playerKeys) // because test environment is not dev? TODO: set an environment variable that we can control this with?
      }
    </div>
  );
}
