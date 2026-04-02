import React, { useState, useEffect, useCallback } from "react";
import * as Sentry from "@sentry/react";
import { useGlobal } from "@empirica/core/player/react";
import { usePlayer } from "@empirica/core/player/classic/react";

// eslint-disable-next-line import/no-extraneous-dependencies
import { Button } from "@deliberation-lab/score/components";
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
  const [errorMessage, setErrorMessage] = useState(null);
  const [stallTimeout, setStallTimeout] = useState(false);

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

  // Stall timeout: show restart escape hatch if a check stays in "waiting" too long
  useEffect(() => {
    if (flowStatus !== "started") return undefined;

    // Always clear stall state when deps change, so a previously-fired
    // timeout doesn't persist after all checks pass.
    setStallTimeout(false);

    let timeoutMs;
    if (permissionsStatus !== "pass") {
      timeoutMs = 30000; // 30s for permissions
    } else if (webcamStatus !== "pass") {
      timeoutMs = 120000; // 120s for camera (call quality test is 30s and retries once on failure)
    } else {
      return undefined;
    }

    const timer = setTimeout(() => {
      setStallTimeout(true);
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, [flowStatus, permissionsStatus, webcamStatus]);

  const hasFailed = permissionsStatus === "fail" || webcamStatus === "fail";

  const handleRestart = useCallback(async () => {
    const activeCheck = permissionsStatus !== "pass" ? "permissions" : "camera";
    const trigger = stallTimeout && !hasFailed ? "stallTimeout" : "failure";

    const restartData = {
      activeCheck,
      trigger,
      permissionsStatus,
      webcamStatus,
      errorMessage,
    };

    player.append("setupSteps", {
      step: "videoEquipmentCheck",
      event: "restart",
      errors: [],
      debug: restartData,
      timestamp: new Date().toISOString(),
    });

    Sentry.captureMessage("Equipment check restart", {
      level: "warning",
      tags: { checkFlow: "video", activeCheck, trigger },
      extra: restartData,
    });

    // Flush Sentry before reload so the diagnostic event is not lost
    await Sentry.flush(2000).catch(() => {});
    window.location.reload();
  }, [permissionsStatus, webcamStatus, stallTimeout, hasFailed, errorMessage, player]);

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
              onClick={() => setFlowStatus("started")}
              data-testid="startVideoSetup"
            >
              Begin camera setup
            </Button>
          </div>
        )}

        {flowStatus === "started" && permissionsStatus !== "pass" && (
          <GetPermissions
            key="permissions"
            setPermissionsStatus={setPermissionsStatus}
            videoOnly
          />
        )}

        {flowStatus === "started" &&
          permissionsStatus === "pass" &&
          webcamStatus !== "pass" && (
            <CameraCheck
              key="camera"
              setWebcamStatus={setWebcamStatus}
              setErrorMessage={setErrorMessage}
            />
          )}

        {flowStatus === "started" && (hasFailed || stallTimeout) && (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {stallTimeout && !hasFailed
                ? "Taking longer than expected? You can restart to try again."
                : errorMessage || "Something went wrong. You can restart the camera setup to try again."}
            </p>
            <Button
              onClick={handleRestart}
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
