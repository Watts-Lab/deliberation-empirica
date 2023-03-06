import React, { useEffect } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { useProgressLabel } from "../components/utils";

export function Qualtrics({ url, onSubmit }) {
  const player = usePlayer();
  const progressLabel = useProgressLabel();

  useEffect(() => {
    const onMessage = (event) => {
      const { data } = event;
      if (data.startsWith("QualtricsEOS")) {
        // survey is complete
        const [, surveyId, sessionId] = data.split("|");
        const record = {
          step: progressLabel,
          survyeyURL: url,
          surveyId,
          sessionId,
        };
        player.set(`qualtrics_${progressLabel}`, record);
        onSubmit();
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  return (
    <div className="h-full" data-test="qualtrics" scrolling="true">
      <iframe // TODO: make this flex stretch to fill window
        className="relative min-h-screen-lg"
        data-test="qualtricsIframe"
        title={`qualtrics_${url}`}
        src={url}
        width="100%"
      />
    </div>
  );
}
