/* eslint-disable react/jsx-no-bind */
import React, { useEffect } from "react";
import "virtual:windi.css";
import "./baseStyles.css";

import { EmpiricaClassic } from "@empirica/core/player/classic";
import { EmpiricaContext } from "@empirica/core/player/classic/react";
import {
  EmpiricaParticipant,
  useGlobal,
  Loading,
} from "@empirica/core/player/react";

import { EmpiricaMenu } from "./components/EmpiricaMenu";
import { NoGames } from "./intro-exit/NoGames";

import { IdForm } from "./intro-exit/IdForm";
import { Consent } from "./intro-exit/Consent";
import { EquipmentCheck } from "./intro-exit/EquipmentCheck";
import { EnterNickname } from "./intro-exit/EnterNickname";
import { AttentionCheck } from "./intro-exit/AttentionCheck";
import { GenericIntroExitStep } from "./intro-exit/GenericIntroExitStep";
import { Countdown } from "./intro-exit/Countdown";
import { Lobby } from "./intro-exit/Lobby";
import { Game } from "./Game";
import { Survey } from "./elements/Survey";
import { QualityControl } from "./intro-exit/QualityControl";
import { Debrief } from "./intro-exit/Debrief";

// Can we remove this function?
export function getURL() {
  const host = window.location.hostname;
  if (host === "localhost") {
    return "http://localhost:3000/query";
  }
  return `https://${host}/query`;
}

function InnerParticipant() {
  const globals = useGlobal();
  if (!globals) return <Loading />;

  const batchConfig = globals.get("recruitingBatchConfig");
  if (!batchConfig) return <NoGames />;

  const { launchDate } = batchConfig;
  const introSequence = globals.get("recruitingBatchIntroSequence");

  function introSteps() {
    const steps = [Consent, AttentionCheck, EquipmentCheck, EnterNickname];

    if (introSequence?.introSteps) {
      introSequence.introSteps.forEach((step, index) => {
        const { name, elements } = step;
        const introStep = ({ next }) =>
          GenericIntroExitStep({ name, elements, index, next });
        steps.push(introStep);
      });
    }

    if (launchDate) steps.push(({ next }) => Countdown({ launchDate, next }));
    return steps;
  }

  function exitSteps({ game }) {
    const steps = [];
    const treatment = game.get("treatment");

    if (treatment.exitSurveys) {
      // leave this for now for backwards compatibility
      console.warn(
        "The treatment.exitSurveys field is deprecated. Please use treatment.exitSequence instead."
      );
      const surveyNames = treatment.exitSurveys;
      const surveyNamesArray =
        surveyNames instanceof Array ? surveyNames : [surveyNames];

      const exitSurveys = surveyNamesArray.map(
        (surveyName) =>
          ({ next }) =>
            Survey({ surveyName, onSubmit: next })
      );
      steps.push(...exitSurveys);
    }

    if (treatment.exitSequence) {
      treatment.exitSequence.forEach((step, index) => {
        const { name, elements } = step;
        const exitStep = ({ next }) =>
          GenericIntroExitStep({ name, elements, index, next });
        steps.push(exitStep);
      });
    }

    steps.push(QualityControl);
    return steps;
  }

  return (
    <EmpiricaContext
      disableConsent
      disableNoGames
      unmanagedGame
      playerCreate={IdForm}
      lobby={Lobby} // doesn't render if there's no game, so rendering manually in Game
      introSteps={introSteps}
      exitSteps={exitSteps}
      finished={Debrief}
    >
      <Game />
    </EmpiricaContext>
  );
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

  const renderPlayer = (playerKey) => (
    <div
      className="h-screen relative rm-5 overflow-auto"
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
        <InnerParticipant />
      </EmpiricaParticipant>
    </div>
  );

  return <>{playerKeys.map(renderPlayer)}</>;
}
