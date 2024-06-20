/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */

import React, { useEffect, useReducer } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { useProgressLabel } from "../components/hooks";

export function Qualtrics({ url, params, onSubmit }) {
  const player = usePlayer();
  const progressLabel = useProgressLabel();

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
    fullURL = `${url}?${paramsObj.toString()}`;
  }

  return (
    <div
      className="h-full w-auto md:min-w-xl lg:min-w-2xl"
      data-test="qualtrics"
      scrolling="true"
    >
      <iframe // TODO: make this flex stretch to fill window
        className="relative min-h-screen-lg"
        data-test="qualtricsIframe"
        title={`qualtrics_${url}`}
        src={fullURL}
        width="100%"
      />
    </div>
  );
}
