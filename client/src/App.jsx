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
import { DailyProvider, useCallObject } from "@daily-co/daily-react";

import { EmpiricaMenu } from "./components/EmpiricaMenu";
import { NoGames } from "./intro-exit/NoGames";

import { IdForm } from "./intro-exit/IdForm";
import { Consent } from "./intro-exit/Consent";
import { VideoEquipmentCheck } from "./intro-exit/setup/VideoEquipmentCheck";
import { AudioEquipmentCheck } from "./intro-exit/setup/AudioEquipmentCheck";
import { EnterNickname } from "./intro-exit/EnterNickname";
import { AttentionCheck } from "./intro-exit/AttentionCheck";
import { GenericIntroExitStep } from "./intro-exit/GenericIntroExitStep";
import { Countdown } from "./intro-exit/Countdown";
import { Lobby } from "./intro-exit/Lobby";
import { Intro } from "./intro-exit/Intro";
import { Game } from "./Game";
import { Exit } from "./intro-exit/Exit";
import { Survey } from "./elements/Survey";
import { QualityControl } from "./intro-exit/QualityControl";
import { Debrief } from "./intro-exit/Debrief";
import { IdleProvider } from "./components/IdleProvider";

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

  useEffect(() => {
    const batchConfig = globals?.get("recruitingBatchConfig");
    window.dlBatchName = batchConfig?.batchName;
  }, [globals]);

  if (!globals) return <Loading />;

  const batchConfig = globals.get("recruitingBatchConfig");
  if (!batchConfig) return <NoGames />;

  const { launchDate } = batchConfig;
  const introSequence = globals.get("recruitingBatchIntroSequence");

  function introSteps() {
    const steps = [
      Consent,
      AttentionCheck,
      VideoEquipmentCheck,
      AudioEquipmentCheck,
      EnterNickname,
    ];

    if (introSequence?.introSteps) {
      introSequence.introSteps.forEach((step, index) => {
        const { name, elements } = step;
        const introStep = ({ next }) =>
          GenericIntroExitStep({ name, elements, index, next, phase: "intro" });
        steps.push(introStep);
      });
    }

    if (launchDate !== "immediate")
      steps.push(({ next }) => Countdown({ launchDate, next }));

    // Wrap each step with the Intro component
    const wrappedSteps = steps.map(
      (Step) =>
        ({ next }) =>
          Intro({ Step, next })
    );

    return wrappedSteps;
  }

  function exitSteps({ game, player }) {
    const steps = [];

    if (player.get("gameId")) {
      // if the player was not assigned to a game, go straight to QC
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
            GenericIntroExitStep({
              name,
              elements,
              index,
              next,
              phase: "exit",
            });
          steps.push(exitStep);
        });
      }
    }

    steps.push(QualityControl);

    // Wrap each step with the Exit component
    const wrappedSteps = steps.map(
      (Step) =>
        ({ next }) =>
          Exit({ Step, next })
    );

    return wrappedSteps;
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
  // We disable Daily's auto-subscribe logic after joining (see Call.jsx), so the
  // hook doesn't need to opt-out here; stick with the plain callObject instance.
  const callObject = useCallObject(); // useCallObject also creates the call object (https://docs.daily.co/reference/daily-react/use-call-object)

  if (playerKeys.length < 1) {
    // this is a common case - most players will show up without keys in their URL
    playerKeys.push("keyless");
  }

  useEffect(() => {
    console.log(`Start: ${process.env.NODE_ENV} environment`);
    console.log(`Test Controls: ${process.env.TEST_CONTROLS}`);
    console.log(`Bundle Date: ${process.env.BUNDLE_DATE}`);
  }, []);

  const renderPlayer = (playerKey) => (
    <div
      className="h-screen relative overflow-auto px-4 sm:px-6 md:px-8"
      key={playerKey}
      data-player-id={playerKey}
      id={playerKey}
    >
      <EmpiricaParticipant
        url={getURL()}
        ns={playerKey}
        modeFunc={EmpiricaClassic}
      >
        {process.env.TEST_CONTROLS === "enabled" && (
          <EmpiricaMenu playerKey={playerKey} />
        )}
        <DailyProvider callObject={callObject}>
          <IdleProvider timeout={60000} chimeInterval={10000}>
            <InnerParticipant />
          </IdleProvider>
        </DailyProvider>
      </EmpiricaParticipant>
    </div>
  );

  return <>{playerKeys.map(renderPlayer)}</>;
}
