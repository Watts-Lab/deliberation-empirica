import { EmpiricaClassic } from "@empirica/core/player/classic";
import { EmpiricaContext } from "@empirica/core/player/classic/react";
import { EmpiricaParticipant } from "@empirica/core/player/react";
import React, { useEffect } from "react";
import "virtual:windi.css";
import { Game } from "./Game";
import { EnterNickname } from "./intro-exit/EnterNickname";
import { Consent } from "./intro-exit/IntegratedConsent";
import { DescriptivePlayerIdForm } from "./intro-exit/DescriptivePlayerIdForm";
import { Survey } from "./elements/Survey";
import { qualityControl } from "./intro-exit/QualityControl";
import { VideoCheck } from "./intro-exit/VideoCheck";
import { Lobby } from "./intro-exit/Lobby";
import { EmpiricaMenu } from "./components/EmpiricaMenu";
import { Countdown } from "./intro-exit/Countdown";
import { PlayableConditionalRender } from "./components/Layouts";
import { GenericIntroStep } from "./intro-exit/GenericIntroStep";

// Can we remove this function?
export function getURL() {
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

  useEffect(() => {
    console.log(`Start: ${process.env.NODE_ENV} environment`);
    console.log(`Test Controls: ${process.env.TEST_CONTROLS}`);
  }, []);

  function introSteps({ player }) {
    const steps = [Consent, VideoCheck, EnterNickname];
    const introSequence = player.get("introSequence");

    introSequence?.introSteps.forEach((step) => {
      const { name, elements } = step;
      const introStep = ({ next }) =>
        GenericIntroStep({ name, elements, next });
      steps.push(introStep);
    });

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
          const exitSurvey = ({ next }) =>
            Survey({ surveyName, onSubmit: next });
          exitSurveys.push(exitSurvey);
        });
      }
    }
    exitSurveys.push(qualityControl); // always show QC survey
    return exitSurveys;
  }

  const renderPlayer = (playerKey) => (
    <div
      className="p-5 pr-10"
      key={playerKey}
      test-player-id={playerKey}
      id={playerKey}
    >
      <EmpiricaParticipant
        url={getURL()}
        ns={playerKey}
        modeFunc={EmpiricaClassic}
      >
        {process.env.TEST_CONTROLS === "enabled" && <EmpiricaMenu />}
        <PlayableConditionalRender>
          <EmpiricaContext
            disableConsent
            playerCreate={DescriptivePlayerIdForm}
            lobby={Lobby}
            introSteps={introSteps} // eslint-disable-line react/jsx-no-bind -- empirica requirement
            exitSteps={exitSteps} // eslint-disable-line react/jsx-no-bind -- empirica requirement
            disableNoGames
          >
            <Game />
          </EmpiricaContext>
        </PlayableConditionalRender>
      </EmpiricaParticipant>
    </div>
  );

  return (
    <div className="h-screen relative rm-5">
      <div className="h-full overflow-auto">{playerKeys.map(renderPlayer)}</div>
    </div>
  );
}
