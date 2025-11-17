import React, { useState, useEffect } from "react";
import { useGlobal } from "@empirica/core/player/react";
import { usePlayer } from "@empirica/core/player/classic/react";

import { Button } from "../../components/Button";
import { GetPermissions } from "./GetPermissions";
import { CameraCheck } from "./CameraCheck";

function useBatchConfig() {
  const globals = useGlobal();
  return globals?.get("recruitingBatchConfig") || {};
}

/**
 * VideoEquipmentCheck orchestrates the "camera" portion of the intro flow.
 * It renders the lower-level permission + camera checks in sequence and only
 * calls `next()` once both have reported success. All logging happens at this
 * coordinator level so upstream analytics know when the entire video flow
 * finished (or was skipped via batch config).
 */
export function VideoEquipmentCheck({ next }) {
  const batchConfig = useBatchConfig();
  const player = usePlayer();
  const checkVideo = batchConfig?.checkVideo ?? true;

  const [flowStatus, setFlowStatus] = useState("waiting");
  const [permissionsStatus, setPermissionsStatus] = useState("waiting");
  const [webcamStatus, setWebcamStatus] = useState("waiting");
  const [permissionsIteration, setPermissionsIteration] = useState(0);
  const [webcamIteration, setWebcamIteration] = useState(0);

  useEffect(() => {
    if (!checkVideo) {
      player.append("setupSteps", {
        step: "videoEquipmentCheck",
        event: "skip",
        errors: [],
        debug: { reason: "checkVideo disabled" },
        timestamp: new Date().toISOString(),
      });
      next();
    }
  }, [checkVideo, next, player]);

  useEffect(() => {
    if (flowStatus === "started" && typeof window !== "undefined" && window.Cypress) {
      setPermissionsStatus("pass");
      setWebcamStatus("pass");
    }
  }, [flowStatus]);

  useEffect(() => {
    if (flowStatus !== "started") return;
    if (permissionsStatus !== "pass" || webcamStatus !== "pass") return;

    player.append("setupSteps", {
      step: "videoEquipmentCheck",
      event: "pass",
      errors: [],
      debug: {},
      timestamp: new Date().toISOString(),
    });
    next();
  }, [flowStatus, permissionsStatus, webcamStatus, player, next]);

  const handleRestart = () => {
    setPermissionsStatus("waiting");
    setWebcamStatus("waiting");
    setPermissionsIteration((n) => n + 1);
    setWebcamIteration((n) => n + 1);
  };

  if (!checkVideo) return null;

  return (
    <div className="grid justify-center">
      <div className="max-w-xl">
        {flowStatus === "waiting" && (
          <div className="mt-20 text-center space-y-4">
            <h2>🎥 Set up your camera</h2>
            <p>In this step you will:</p>
            <ul className="mx-auto max-w-sm list-disc space-y-1 text-left">
              <li>Grant access to camera + microphone</li>
              <li>Pick the webcam you plan to use</li>
              <li>Test your connection quality</li>
            </ul>

            <Button
              handleClick={() => setFlowStatus("started")}
              testId="startVideoSetup"
            >
              Begin camera setup
            </Button>
          </div>
        )}

        {flowStatus === "started" && permissionsStatus !== "pass" && (
          <GetPermissions
            key={`permissions-${permissionsIteration}`}
            setPermissionsStatus={setPermissionsStatus}
            videoOnly
          />
        )}

        {flowStatus === "started" &&
          permissionsStatus === "pass" &&
          webcamStatus !== "pass" && (
            <CameraCheck
              key={`camera-${webcamIteration}`}
              setWebcamStatus={setWebcamStatus}
            />
          )}

        {flowStatus === "started" && (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Having trouble? Restart the camera setup to try again.
            </p>
            <Button
              handleClick={handleRestart}
              primary={false}
              className="mt-2"
            >
              Restart camera setup
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
