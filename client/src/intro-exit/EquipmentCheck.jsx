import React, { useState } from "react";
import { useGlobal } from "@empirica/core/player/react";
import { DailyProvider } from "@daily-co/daily-react";

import { CameraCheck } from "../components/CameraCheck";
import { Button } from "../components/Button";

const roomUrl = "https://deliberation.daily.co/HairCheckRoom";

export function EquipmentCheck({ next }) {
  const globals = useGlobal();
  const batchConfig = globals?.get("recruitingBatchConfig");
  const checkVideo = batchConfig?.checkVideo ?? true; // default to true if not specified
  const checkAudio = (batchConfig?.checkAudio ?? true) || checkVideo; // default to true if not specified, force true if checkVideo is true

  const [webcamSuccess, setWebcamSuccess] = useState(!!window.Cypress); // In cypress tests, skip to the end.

  // DailyProvider creates its own callObject instance, that we can access in child components
  return (
    <DailyProvider url={roomUrl}>
      <div className="grid justify-center">
        <div className="max-w-xl">
          {!webcamSuccess && (
            <CameraCheck onSuccess={() => setWebcamSuccess(true)} />
          )}

          {webcamSuccess && (
            <Button testId="continueWebcam" handleClick={() => next()}>
              Continue
            </Button>
          )}
        </div>
      </div>
    </DailyProvider>
  );
}
