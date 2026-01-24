import React, { useState, useEffect, useCallback } from "react";
import { useGlobal } from "@empirica/core/player/react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { useDaily } from "@daily-co/daily-react";

import { Button } from "../../components/Button";
import { HeadphonesCheck } from "./HeadphonesCheck";
import { MicCheck } from "./MicCheck";
import { LoopbackCheck } from "./LoopbackCheck";
import { GetPermissions } from "./GetPermissions";

function useBatchConfig() {
  const globals = useGlobal();
  return globals?.get("recruitingBatchConfig") || {};
}

/**
 * AudioEquipmentCheck orchestrates the headphone/mic/loopback portion of the
 * intro flow. It renders each underlying check one at a time and only calls
 * `next()` once all have finished. The component also warms up Daily's device
 * layer (if the camera step was skipped) so `HeadphonesCheck`/`MicCheck`
 * receive a consistent device list even after refreshes.
 */
export function AudioEquipmentCheck({ next }) {
  const batchConfig = useBatchConfig();
  const player = usePlayer();
  const callObject = useDaily();
  const checkVideo = batchConfig?.checkVideo ?? true;
  const checkAudio = (batchConfig?.checkAudio ?? true) || checkVideo;

  const [flowStatus, setFlowStatus] = useState("waiting");
  const [headphonesStatus, setHeadphonesStatus] = useState("waiting");
  const [micStatus, setMicStatus] = useState("waiting");
  const [loopbackStatus, setLoopbackStatus] = useState("waiting");
  const [permissionsStatus, setPermissionsStatus] = useState("waiting");

  const loopbackComplete =
    loopbackStatus === "pass" ||
    loopbackStatus === "fail" ||
    loopbackStatus === "override";

  useEffect(() => {
    if (!checkAudio) {
      player.append("setupSteps", {
        step: "audioEquipmentCheck",
        event: "skip",
        errors: [],
        debug: { reason: "checkAudio disabled" },
        timestamp: new Date().toISOString(),
      });
      next();
    }
  }, [checkAudio, next, player]);

  useEffect(() => {
    if (
      flowStatus === "started" &&
      typeof window !== "undefined" &&
      window.Cypress
    ) {
      setPermissionsStatus("pass");
      setHeadphonesStatus("pass");
      setMicStatus("pass");
      setLoopbackStatus("pass");
    }
  }, [flowStatus]);

  useEffect(() => {
    if (flowStatus !== "started") return;
    if (permissionsStatus !== "pass") return;
    if (
      headphonesStatus !== "pass" ||
      micStatus !== "pass" ||
      !loopbackComplete
    )
      return;

    player.append("setupSteps", {
      step: "audioEquipmentCheck",
      event: "pass",
      errors: [],
      debug: {},
      timestamp: new Date().toISOString(),
    });
    next();
  }, [flowStatus, headphonesStatus, micStatus, loopbackComplete, player, next]);

  const resetAudioChecks = useCallback(() => {
    window.location.reload();
  }, []);

  useEffect(() => {
    if (flowStatus !== "started") return;
    if (!callObject) return;
    if (permissionsStatus !== "pass") return;
    const cameraState = callObject.cameraState?.();
    if (cameraState?.camera === "started") return;

    let cancelled = false;
    const startDailyAudio = async () => {
      try {
        await callObject.startCamera({ audio: true, video: false });
        if (cancelled) return;
      } catch (err) {
        console.error("Failed to warm up Daily audio devices", err);
      }
    };

    startDailyAudio();

    return () => {
      cancelled = true;
      if (!callObject || callObject.isDestroyed?.()) return;
      if (callObject.cameraState?.().camera === "started") return;
      try {
        callObject.stopCamera();
      } catch (err) {
        console.warn("Failed to stop Daily audio warmup", err);
      }
    };
  }, [flowStatus, callObject, permissionsStatus]);

  if (!checkAudio) return null;

  return (
    <div className="grid justify-center">
      <div className="max-w-xl">
        {flowStatus === "waiting" && (
          <div className="mt-20 text-center space-y-4">
            <h2>🔊 Set up your sound</h2>
            <p>In this section, we&apos;ll ask you to:</p>
            <ul className="mx-auto max-w-sm list-disc space-y-1 text-left">
              <li>Put on headphones or earbuds</li>
              <li>Test that your headphones are working</li>
              <li>Choose the mic you&apos;ll speak into</li>
              <li>Check for audio feedback</li>
            </ul>
            <Button
              handleClick={() => setFlowStatus("started")}
              testId="startAudioSetup"
            >
              Begin audio setup
            </Button>
          </div>
        )}

        {flowStatus === "started" && permissionsStatus !== "pass" && (
          <GetPermissions
            key="audio-permissions"
            setPermissionsStatus={setPermissionsStatus}
            permissionsMode="audio"
          />
        )}

        {flowStatus === "started" &&
          permissionsStatus === "pass" &&
          headphonesStatus !== "pass" && (
            <HeadphonesCheck
              key="headphones"
              setHeadphonesStatus={setHeadphonesStatus}
            />
          )}

        {flowStatus === "started" &&
          permissionsStatus === "pass" &&
          headphonesStatus === "pass" &&
          micStatus !== "pass" && (
            <MicCheck key="mic" setMicStatus={setMicStatus} />
          )}

        {flowStatus === "started" &&
          permissionsStatus === "pass" &&
          micStatus === "pass" &&
          loopbackStatus !== "pass" && (
            <LoopbackCheck
              key="loopback"
              loopbackStatus={loopbackStatus}
              setLoopbackStatus={setLoopbackStatus}
              onRetryAudio={resetAudioChecks}
            />
          )}

        {flowStatus === "started" &&
          (permissionsStatus === "fail" ||
            headphonesStatus === "fail" ||
            micStatus === "fail" ||
            loopbackStatus === "fail") && (
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Something went wrong. You can restart the audio checks to try
                again.
              </p>
              <Button
                handleClick={resetAudioChecks}
                primary={false}
                className="mt-2"
              >
                Restart audio checks
              </Button>
            </div>
          )}
      </div>
    </div>
  );
}
