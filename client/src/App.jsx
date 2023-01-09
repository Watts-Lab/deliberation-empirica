import { EmpiricaClassic } from "@empirica/core/player/classic";
import { EmpiricaContext, useGame } from "@empirica/core/player/classic/react";
import { EmpiricaParticipant, useGlobal } from "@empirica/core/player/react";
import React, { useEffect } from "react";
import { isMobile } from "react-device-detect";
import "virtual:windi.css"; // what is this => Tailwind like CSS framework https://windicss.org/
import { isDevelopment } from "@empirica/core/player";
import { detect } from "detect-browser";
import { Game } from "./Game";
import { Introduction } from "./intro-exit/Introduction";
import { Alert } from "./components/Alert";
import { IRBConsent } from "./intro-exit/IRBConsent";
import { PlayerIDForm } from "./intro-exit/PlayerIDForm";
import { ExitSurvey } from "./intro-exit/ExitSurvey";
import { qualityControl } from "./intro-exit/QualityControl";
import { VideoCheck } from "./intro-exit/VideoCheck";
import { Lobby } from "./intro-exit/Lobby";
import { NoGames } from "./intro-exit/NoGames";
import { EmpiricaMenu } from "./components/EmpiricaMenu";
import { Countdown } from "./intro-exit/Countdown";

export function getURL() {
  // helps resolve some issues with running from the localhost over ngrok
  // TODO: find out if we can remove this
  const host = window.location.hostname;

  if (host === "localhost") {
    return "http://localhost:3000/query";
  }

  return `https://${host}/query`;
}

function NoGamesWrapper({ children }) {
  const globals = useGlobal();
  const game = useGame();
  if (!globals?.get("batchOpen") && !game) {
    return <NoGames />;
  }
  return <>{children}</>;
}

// eslint-disable-next-line import/no-default-export
export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const playerKeys = urlParams.getAll("playerKey");

  useEffect(() => {
    console.log(`Start: ${process.env.NODE_ENV} environment`);
  }, []);

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

  if (playerKeys.length < 1) {
    // this is a common case - most players will show up without keys in their URL
    playerKeys.push("keyless");
  }

  playerKeys.forEach((playerKey, index) => {
    console.log(`player_${index} key:`, playerKey);
  });

  // eslint-disable-next-line no-unused-vars
  function introSteps({ player }) {
    const steps = [Introduction, VideoCheck];
    if (player.get("launchDate")) {
      steps.push(Countdown);
    }
    return steps;
  }

  // eslint-disable-next-line no-unused-vars
  function exitSteps({ game, player }) {
    const exitSurveys = [];
    if (game) {
      let surveyNames = game.get("treatment").exitSurveys;
      if (surveyNames) {
        if (!(surveyNames instanceof Array)) {
          surveyNames = [surveyNames];
        }
        surveyNames.forEach((surveyName) => {
          const exitSurvey = ({ next }) => ExitSurvey({ surveyName, next });
          exitSurveys.push(exitSurvey);
        });
      }
    }
    exitSurveys.push(qualityControl); // always show QC survey
    return exitSurveys;
  }

  const browser = detect();
  const majorVersion = browser?.version.split(".")[0];
  const browserIsSupported =
    majorVersion >= 89 || // chrome, firefox, edge
    (majorVersion >= 75 && browser?.name === "opera") ||
    (majorVersion >= 15 && browser?.name === "safari");

  if (!browserIsSupported) {
    return (
      <div className="h-screen relative mx-2 my-5">
        <Alert kind="error" title="ERROR: Browser Version Detected">
          Your browser is not supported. Please visit the study link with a more
          up-to-date browser.
        </Alert>

        <h3>List of Supported Browsers:</h3>
        <ul>
          <li>Chrome {">"}= 89 </li>
          <li>Edge {">"}= 89 </li>
          <li>Firefox {">"}= 89 </li>
          <li>Opera {">"}= 75 </li>
          <li>Safari {">"}= 15 </li>
        </ul>
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
          <NoGamesWrapper>
            <EmpiricaContext
              consent={IRBConsent}
              playerCreate={PlayerIDForm}
              noGames={NoGames}
              lobby={Lobby}
              introSteps={introSteps} // eslint-disable-line react/jsx-no-bind -- empirica requirement
              exitSteps={exitSteps} // eslint-disable-line react/jsx-no-bind -- empirica requirement
              disableNoGames
            >
              <Game />
            </EmpiricaContext>
          </NoGamesWrapper>
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
