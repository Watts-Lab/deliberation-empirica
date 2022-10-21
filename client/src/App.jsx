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
import { ExitSurvey } from "./intro-exit/Surveys/ExitSurvey";
import { qualityControl } from "./intro-exit/Surveys/quality_control";
import { VideoCheck } from "./intro-exit/VideoCheck";
import { Lobby } from "./pages/Lobby";
import { NoGamesWithSorry } from "./pages/NoGamesWithSorry";
import { EmpiricaMenu } from "./components/EmpiricaMenu";
import { detect } from "detect-browser";

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
  var fit = true;
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
    // eslint-disable-line no-unused-vars -- documents arguments
    if (debug) {
      return [EnterNickname];
    }

    return [IntroCheck, EnterNickname, VideoCheck];
  }

  function exitSteps({ game, player }) {
    // eslint-disable-line no-unused-vars -- documents arguments
    const exitSurveys = [];
    if (game) { 
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

  /*Uses the detect-browser package to check if user's browser is compatible with Empirica */
  const browser = detect();
  console.log(browser);
  var browser_version = browser.version.split(".");
  // handle the case where we don't detect the browser
  switch (browser && browser.name) {
    case "chrome":
      if (browser_version < 89) {
        fit = false;
      }
      break;
    case "firefox":
      if (browser_version < 89) {
        fit = false;
      }
      break;
    case "edge":
      if (browser_version < 89) {
        fit = false;
      }
      break;
    case "safari":
      if (browser_version < 15) {
        fit = false;
      }
      break;
    case "opera":
      if (browser_version < 75) {
        fit = false;
      }
      break;
    default:
      fit = false;
  }
  if (!fit) {
    return (
      <div className="h-screen relative mx-2 my-5">
        <Alert kind="error" title="ERROR: Browser Version Detected">
          Your browser is not supported. Please visit the study link with a more
          up-to-date browser.
        </Alert>

        <h3>List of Supported Browser</h3>
        <ul>
          <li>Chrome >= 89 </li>
          <li>Edge >= 89 </li>
          <li>Firefox >= 89 </li>
          <li>Opera >= 75 </li>
          <li>Safari >= 15 </li>
        </ul>
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
    <div className="h-screen relative">
      {
        // renderPlayers(['dev', 'test'].includes(game.get("deployEnvironment")) ? playerKeys : [playerKeys[0]])
        renderPlayers(playerKeys) // because test environment is not dev? TODO: set an environment variable that we can control this with?
      }
    </div>
  );
}
