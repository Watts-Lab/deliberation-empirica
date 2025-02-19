/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */

import React, { useEffect, useReducer } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";

export function Qualtrics({ url, params, onSubmit }) {
  const player = usePlayer();
  const progressLabel = player.get("progressLabel");
  const deliberationId = player?.get("participantData")?.deliberationId;

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

  const [state, dispatch] = useReducer(reducer, {
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

  let fullURL = url;
  if (params) {
    const paramsObj = new URLSearchParams();
    for (const { key, value } of params) {
      paramsObj.append(key, value);
    }
    paramsObj.append("deliberationId", deliberationId); // deliberationId is always passed so that we can link qualtrics responses to participants within qualtrics data
    fullURL = `${url}?${paramsObj.toString()}`;
  }

  return (
    <div
      // className="h-full w-auto md:min-w-xl lg:min-w-2xl"
      data-test="qualtrics"
      className="h-full min-w-[800px] lg:min-w-[1024px] max-w-none overflow-x-auto"
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
