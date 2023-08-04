/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */

import React, { useEffect } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { useProgressLabel } from "../components/utils";

export function Qualtrics({ url, params, onSubmit }) {
  const player = usePlayer();
  const progressLabel = useProgressLabel();

  useEffect(() => {
    const onMessage = (event) => {
      const { data } = event;
      if (data?.startsWith("QualtricsEOS")) {
        // survey is complete
        const [, surveyId, sessionId] = data.split("|");
        const record = {
          step: progressLabel,
          survyeyURL: url,
          surveyId,
          sessionId,
        };
        // player.set(`qualtrics_${progressLabel}`, record);
        player.set(`qualtricsDataReady`, record);
        onSubmit();
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  let fullURL = url;
  if (params) {
    const paramsObj = new URLSearchParams();
    for (const { key, value } of params) {
      paramsObj.append(key, value);
    }
    fullURL = `${url}?${paramsObj.toString()}`;
  }

  return (
    <div className="h-full" data-test="qualtrics" scrolling="true">
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
