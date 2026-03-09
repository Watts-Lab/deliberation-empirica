import React, { useState, useEffect, useCallback } from "react";
import * as Sentry from "@sentry/react";
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
  const [loopbackStatus, setLoopbackStatus] = useState("pass"); // TEMP: skip loopback to test if it's causing quiet audio
  const [permissionsStatus, setPermissionsStatus] = useState("waiting");
  const [errorMessage, setErrorMessage] = useState(null);
  const [stallTimeout, setStallTimeout] = useState(false);

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
  }, [flowStatus, permissionsStatus, headphonesStatus, micStatus, loopbackComplete, player, next]);

  // Stall timeout: show restart escape hatch if a check is stuck.
  // For headphones, only start timing once the user clicks Play ("started"),
  // not while they are still selecting a speaker ("waiting").
  useEffect(() => {
    if (flowStatus !== "started") return undefined;

    // Always clear stall state when deps change, so a previously-fired
    // timeout doesn't persist after all checks pass.
    setStallTimeout(false);

    let timeoutMs;
    if (permissionsStatus !== "pass") {
      timeoutMs = 30000;
    } else if (headphonesStatus === "started") {
      timeoutMs = 15000;
    } else if (headphonesStatus !== "pass") {
      return undefined; // still selecting speaker, no timer yet
    } else if (micStatus === "started") {
      timeoutMs = 15000;
    } else if (micStatus !== "pass") {
      return undefined; // still selecting mic, no timer yet
    } else if (!loopbackComplete) {
      timeoutMs = 15000;
    } else {
      return undefined;
    }

    const timer = setTimeout(() => {
      setStallTimeout(true);
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, [flowStatus, permissionsStatus, headphonesStatus, micStatus, loopbackComplete]);

  const hasFailed =
    permissionsStatus === "fail" ||
    headphonesStatus === "fail" ||
    micStatus === "fail" ||
    loopbackStatus === "fail";

  const resetAudioChecks = useCallback(async () => {
    let activeCheck = "loopback";
    if (permissionsStatus !== "pass") activeCheck = "permissions";
    else if (headphonesStatus !== "pass") activeCheck = "headphones";
    else if (micStatus !== "pass") activeCheck = "mic";

    const trigger = stallTimeout && !hasFailed
      ? "stallTimeout"
      : "failure";

    const restartData = {
      activeCheck,
      trigger,
      permissionsStatus,
      headphonesStatus,
      micStatus,
      loopbackStatus,
      errorMessage,
    };

    player.append("setupSteps", {
      step: "audioEquipmentCheck",
      event: "restart",
      errors: [],
      debug: restartData,
      timestamp: new Date().toISOString(),
    });

    Sentry.captureMessage("Equipment check restart", {
      level: "warning",
      tags: { checkFlow: "audio", activeCheck, trigger },
      extra: restartData,
    });

    // Flush Sentry before reload so the diagnostic event is not lost
    await Sentry.flush(2000).catch(() => {});
    window.location.reload();
  }, [
    permissionsStatus, headphonesStatus, micStatus,
    loopbackStatus, stallTimeout, hasFailed,
    errorMessage, player,
  ]);

  useEffect(() => {
    if (flowStatus !== "started") return undefined;
    if (!callObject) return undefined;
    if (permissionsStatus !== "pass") return undefined;
    const cameraState = callObject.cameraState?.();
    if (cameraState?.camera === "started") return undefined;

    let cancelled = false;
    const startDailyAudio = async () => {
      try {
        await callObject.startCamera({ audio: true, video: false });
        if (cancelled) return; // eslint-disable-line no-useless-return
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
              setErrorMessage={setErrorMessage}
            />
          )}

        {flowStatus === "started" &&
          permissionsStatus === "pass" &&
          headphonesStatus === "pass" &&
          micStatus !== "pass" && (
            <MicCheck
              key="mic"
              setMicStatus={setMicStatus}
              setErrorMessage={setErrorMessage}
            />
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
              setErrorMessage={setErrorMessage}
            />
          )}

        {flowStatus === "started" && (hasFailed || stallTimeout) && (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {stallTimeout && !hasFailed
                ? "Taking longer than expected? You can restart to try again."
                : errorMessage || "Something went wrong. You can restart the audio checks to try again."}
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
