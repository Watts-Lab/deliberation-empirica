import React, { useEffect, useMemo, useReducer } from "react";
import {
  useGame,
  usePlayer,
  usePlayers,
} from "@empirica/core/player/classic/react";
import { useIdleContext } from "../components/IdleProvider";
import { useProgressLabel } from "../components/progressLabel";
import { resolveReferenceValues as resolveReferences } from "../components/referenceResolver";
import { serializeParamValue, pickFirstDefined } from "./urlParamUtils";

export function Qualtrics({ url, urlParams, onSubmit }) {
  const game = useGame();
  const player = usePlayer();
  const players = usePlayers();
  const { setAllowIdle } = useIdleContext();
  const progressLabel = useProgressLabel();
  const deliberationId = player?.get("participantData")?.deliberationId;
  const sampleId = player?.get("sampleId") || "noSampleId";

  // Allow idle because if the mouse is just inside the qualtrics iframe,
  // we won't detect it as moving.
  useEffect(() => {
    // Set allowIdle to true when the component loads
    setAllowIdle(true);
    console.log("Set Allow Idle");

    // Reset allowIdle to false when the component unloads
    return () => {
      setAllowIdle(false);
      console.log("Clear Allow Idle");
    };
  }, [setAllowIdle]);

  const reducer = (state, action) => {
    if (!action.type) return state;
    const newState = { ...state };

    if (
      action.type === "windowMessage" &&
      typeof action?.messageData === "string" &&
      action?.messageData?.startsWith("QualtricsEOS")
    ) {
      newState.qualtricsSubmitted = true;

      const [, surveyId, sessionId] = action.messageData.split("|");
      const record = {
        step: progressLabel,
        surveyURL: url,
        surveyId,
        sessionId,
      };
      player.set(`qualtricsDataReady`, record);
      onSubmit();
    }

    return newState;
  };

  const [, dispatch] = useReducer(reducer, {
    qualtricsSubmitted: false,
  });

  useEffect(() => {
    const onMessage = (event) =>
      dispatch({ type: "windowMessage", messageData: event.data });

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [url, onSubmit, progressLabel]);

  const resolvedParams = useMemo(() => {
    if (!urlParams) return [];
    return urlParams.map((param) => {
      if (!param.reference) {
        return {
          key: param.key,
          value: param.value === undefined ? "" : serializeParamValue(param.value),
        };
      }
      const referenceValues = resolveReferences({
        reference: param.reference,
        position: param.position,
        player,
        game,
        players,
      });
      const pickedValue = pickFirstDefined(referenceValues);
      const resolvedValue =
        pickedValue === undefined ? "" : serializeParamValue(pickedValue);
      if (pickedValue === undefined && referenceValues?.length) {
        console.warn(
          `Qualtrics: reference ${param.reference} resolved to undefined.`,
          referenceValues
        );
      }
      return { key: param.key, value: resolvedValue };
    });
  }, [game, urlParams, player, players]);

  const fullURL = useMemo(() => {
    const urlObj = new URL(url);
    resolvedParams.forEach(({ key, value }) => urlObj.searchParams.append(key, value));
    urlObj.searchParams.append("deliberationId", deliberationId); // always passed to link qualtrics responses to participants
    urlObj.searchParams.append("sampleId", sampleId); // always passed to link qualtrics responses to participants
    return urlObj.toString();
  }, [url, resolvedParams, deliberationId, sampleId]);

  return (
    <div
      // className="h-full w-auto md:min-w-xl lg:min-w-2xl"
      data-test="qualtrics"
      className="h-full min-w-[800px] lg:min-w-3xl max-w-4xl overflow-x-auto"
      // className="h-full w-full"
    >
      <div className="flex-grow">
        <iframe // TODO: make this flex stretch to fill window
          // className="relative min-h-screen-lg w-full"
          className="relative h-full min-h-screen w-full"
          data-test="qualtricsIframe"
          title={`qualtrics_${url}`}
          src={fullURL}
          width="100%"
        />
      </div>
    </div>
  );
}
