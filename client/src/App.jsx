import { EmpiricaClassic } from "@empirica/core/player/classic";
import { EmpiricaContext } from "@empirica/core/player/classic/react";
import { EmpiricaParticipant } from "@empirica/core/player/react";
import React, { useEffect } from "react";
import { isMobile } from "react-device-detect";
import "virtual:windi.css"; // what is this => Tailwind like CSS framework https://windicss.org/
import { isDevelopment } from "@empirica/core/player";
// import { debug } from "deliberation-empirica/debug";
import { Game } from "./Game";
import { IntroCheck } from "./intro-exit/IntroCheck";
// import BetaVideoConsent from './intro-exit/BetaVideoConsent';
import { Alert } from "./components/Alert";
import { EnterNickname } from "./intro-exit/EnterNickname";
import { IRBConsent } from "./intro-exit/IRBConsent";
import { PlayerIDForm } from "./intro-exit/PlayerIDForm";
import { exitSurveys } from "./intro-exit/Surveys/ExitSurvey";
import { qualityControl } from "./intro-exit/Surveys/quality_control";
import { VideoCheck } from "./intro-exit/VideoCheck";
import { Lobby } from "./pages/Lobby";
import { NoGamesWithSorry } from "./pages/NoGamesWithSorry";
import { EmpiricaMenu } from "./components/EmpiricaMenu";

const debug = false;

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
  const urlParams = new URLSearchParams(window.location.search);
  const playerKeys = urlParams.getAll("playerKey");
  if (playerKeys.length < 1) {
    // this is a common case - most players will show up without keys in their URL
    playerKeys.push("keyless");
  }

  playerKeys.forEach((playerKey, index) => {
    console.log(`player_${index} key:`, playerKey);
  });

  useEffect(() => {
    console.log(`Start: ${process.env.NODE_ENV} environment`);
  }, []);

  function introSteps({ game, player }) {
    if (debug) {
      return [EnterNickname];
    }

    return [
      IntroCheck,
      // BetaVideoConsent,
      EnterNickname,
      VideoCheck,
    ];
  }

  function exitSteps({ game, player }) {
    return [exitSurveys, qualityControl];
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
      <div key={playerKey} test-player-id={playerKey}>
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
            introSteps={introSteps}
            exitSteps={exitSteps}
          >
            <Game />
          </EmpiricaContext>
        </EmpiricaParticipant>
      </div>
    ));

    return <div className="h-full overflow-auto">{players}</div>;
  }

  // the second player in this block lets us cypress test multiple players at the
  // same time.
  return (
    <div className="h-screen relative">
      {
        // renderPlayers(['dev', 'test'].includes(game.get("deployEnvironment")) ? playerKeys : [playerKeys[0]])
        renderPlayers(playerKeys) // because test environment is not dev? TODO: set an environment variable that we can control this with?
      }
    </div>
  );
}
