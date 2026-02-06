import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  DailyAudio,
  useDaily,
  useDevices,
  useLocalSessionId,
} from "@daily-co/daily-react";
import {
  useGame,
  usePlayer,
  useStage,
  useStageTimer,
} from "@empirica/core/player/classic/react";

import { Tray } from "./Tray";
import { Call } from "./Call";
import { useDailyEventLogger } from "./hooks/eventLogger";
import { useAutoDiagnostics } from "./useAutoDiagnostics";
import { useAudioContextMonitor } from "./useAudioContextMonitor";
import { UserMediaError } from "./UserMediaError";
import {
  useProgressLabel,
  useGetElapsedTime,
} from "../components/progressLabel";

export function VideoCall({
  showNickname,
  showTitle,
  showSelfView = true,
  showReportMissing = true,
  layout,
  rooms,
}) {
  // ------------------- load Empirica + Daily context ---------------------
  const game = useGame();
  const player = usePlayer();
  const callObject = useDaily();
  const stage = useStage();
  const stageTimer = useStageTimer();

  useDailyEventLogger();

  // ------------------- monitor AudioContext state for autoplay debugging ---------------------
  // Browsers (especially Safari) may suspend AudioContext due to autoplay policies.
  // This hook monitors AudioContext state and provides controls to resume it.
  const {
    audioContextState,
    needsUserInteraction,
    resumeAudioContext,
    audioContext,
  } = useAudioContextMonitor();

  // ------------------- auto-respond to diagnostic requests from roommates ---------------------
  // When another participant reports an A/V issue, they may request diagnostics from us.
  // This hook listens for those requests and automatically sends our diagnostic data to Sentry.
  useAutoDiagnostics(audioContext);

  // ------------------- mirror Nickname into the Daily room ---------------------
  // Set display name in Daily call based on previously set player name/title.
  let displayName = "";
  if (showNickname && player.get("name")) {
    displayName += player.get("name");
  }
  if (showTitle && player.get("title")) {
    if (displayName) {
      displayName += " - ";
    }
    displayName += player.get("title");
  }
  if (!displayName) {
    displayName = `Participant ${player.get("position")}`;
  }

  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.()) return;
    try {
      callObject.setUserName(displayName);
    } catch (err) {
      console.warn("Failed to set Daily username", err);
    }
  }, [callObject, displayName]);

  // ------------------- remember player Daily IDs for layout + UI ---------------------
  // Store Daily ID in player data for later matching with video feeds
  // and for displaying participant lists by position.
  // We also strictly log the association between dailyId, progressLabel, and time.
  const dailyId = useLocalSessionId();
  const progressLabel = useProgressLabel();
  const getElapsedTime = useGetElapsedTime();
  const stageElapsed = (stageTimer?.elapsed || 0) / 1000;

  useEffect(() => {
    if (!dailyId) return;

    // 1. Maintain simple list and current ID (legacy/display usage)
    if (player.get("dailyId") !== dailyId) {
      console.log("Setting player Daily ID:", dailyId);
      player.set("dailyId", dailyId); // for matching with videos later
      player.append("dailyIds", dailyId); // for displaying by position
    }

    // 2. Log structured history for science data
    // Avoid duplicate entries if nothing changed (e.g. re-renders)
    const history = player.get("dailyIdHistory") || [];
    const lastEntry = history[history.length - 1];

    if (
      lastEntry &&
      lastEntry.dailyId === dailyId &&
      lastEntry.progressLabel === progressLabel
    ) {
      return;
    }

    console.log("Logging Video Identity Change", { dailyId, progressLabel });
    player.append("dailyIdHistory", {
      dailyId,
      progressLabel,
      stageElapsed: getElapsedTime(),
      timestamp: new Date().toISOString(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyId, player, progressLabel]);

  // ------------------- manage room joins/leaves ---------------------
  // Join and leave the Daily room when roomUrl changes
  const roomUrl = game.get("dailyUrl");
  const joiningMeetingRef = useRef(false);

  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.() || !roomUrl) return undefined;
    // `roomUrl` is only populated when the batch config had checkVideo/checkAudio enabled.
    // When both flags are false we skip Daily entirely (handy for layout demos), so this
    // effect bails before trying to join a non-existent room.

    const joinRoom = async () => {
      const meetingState = callObject.meetingState?.();
      if (meetingState === "joined-meeting" || joiningMeetingRef.current)
        return;

      console.log("Trying to join Daily room:", roomUrl);
      joiningMeetingRef.current = true;

      try {
        await callObject.join({ url: roomUrl });
        console.log("Joined Daily room:", roomUrl);

        // TEMP: Disable autoGainControl to test if it's causing quiet audio issues.
        // Keep echo cancellation and noise suppression enabled.
        // See: https://docs.daily.co/reference/daily-js/instance-methods/set-input-devices-async
        try {
          await callObject.setInputDevicesAsync({
            audioSource: {
              autoGainControl: false,
              echoCancellation: true,
              noiseSuppression: true,
            },
          });
          console.log("Disabled AGC via setInputDevicesAsync");
        } catch (agcErr) {
          console.warn("Failed to disable AGC:", agcErr);
        }
      } catch (err) {
        console.error("Error joining Daily room", roomUrl, err);
      } finally {
        joiningMeetingRef.current = false;
      }
    };

    joinRoom(); // in a function to allow async/await

    return () => {
      // cleanup on unmount or roomUrl change
      if (!callObject || callObject.isDestroyed?.()) return;
      const state = callObject.meetingState?.();

      if (
        // state === "joining" ||
        state === "joined-meeting" ||
        state === "loaded"
      ) {
        // only leave if we are in the process of joining or already joined
        console.log("Leaving Daily room");
        callObject.leave();
      }
    };
  }, [callObject, roomUrl]);

  // ------------------- signal server when the call begins ---------------------
  // Signal the server to start recording when we have joined the call.

  const pendingCallStartRef = useRef(false);

  const attemptCallStartFlag = useCallback(() => {
    if (!pendingCallStartRef.current) return;
    if (!stage || stage.get("callStarted") === true) return;
    try {
      stage.set("callStarted", true);
      pendingCallStartRef.current = false;
    } catch (err) {
      console.error("Failed to mark callStarted", err);
    }
  }, [stage]);

  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.()) return undefined;

    const handleJoined = () => {
      // Daily may emit joined-meeting before Empirica gives us a stage object;
      // (happens because the join happens immediately when the stage starts)
      // remember the intent and retry once stage is ready rather than dropping
      // the recording trigger entirely.

      pendingCallStartRef.current = true;
      attemptCallStartFlag();
    };

    callObject.on("joined-meeting", handleJoined);

    return () => {
      callObject.off("joined-meeting", handleJoined);
    };
  }, [callObject, attemptCallStartFlag]);

  useEffect(() => {
    attemptCallStartFlag();
  }, [attemptCallStartFlag, stage]);

  // ------------------- capture device permission failures ---------------------
  const [deviceError, setDeviceError] = useState(null);

  // ------------------- handle audio playback failures ---------------------
  // Browsers may block audio playback until user interacts with the page.
  // This can happen after tab switches or due to autoplay policies.
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);

  const handleAudioPlayFailed = useCallback((e) => {
    console.warn("[Audio] Playback failed:", e);
    // Only show the prompt if it looks like an autoplay/gesture issue
    if (e.name === "NotAllowedError" || e.message?.includes("user gesture")) {
      setAudioPlaybackBlocked(true);
    }
  }, []);

  const handleEnableAudio = useCallback(() => {
    // User clicked, which provides the gesture context browsers need.
    // The DailyAudio component will retry on its own when tracks update.
    setAudioPlaybackBlocked(false);

    // Resume the AudioContext (requires user gesture)
    resumeAudioContext().catch((err) => {
      console.error("[Audio] Failed to resume AudioContext:", err);
    });
  }, [resumeAudioContext]);

  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.()) return undefined;

    const handleDeviceError =
      (type) =>
      (ev = {}) => {
        const rawMessage =
          typeof ev.errorMsg === "string"
            ? ev.errorMsg
            : ev?.errorMsg?.message || ev?.error?.message;

        // Extract Daily's error type (e.g., "not-found", "permissions", "in-use", "constraints")
        const dailyErrorType =
          ev?.error?.type || ev?.errorMsg?.type || ev?.type;

        setDeviceError({
          type,
          message: rawMessage || null,
          dailyErrorType: dailyErrorType || null,
          dailyEvent: ev, // Preserve the full Daily event for diagnosis
        });
      };

    const fatalHandler = handleDeviceError("fatal-devices-error");
    const cameraHandler = handleDeviceError("camera-error");
    const micHandler = handleDeviceError("mic-error");

    callObject.on("fatal-devices-error", fatalHandler);
    callObject.on("camera-error", cameraHandler);
    callObject.on("mic-error", micHandler);

    return () => {
      callObject.off("fatal-devices-error", fatalHandler);
      callObject.off("camera-error", cameraHandler);
      callObject.off("mic-error", micHandler);
    };
  }, [callObject]);

  // ------------------- monitor browser permissions during call ---------------------
  // Users can revoke permissions mid-call (accidentally or intentionally), and browsers
  // can auto-revoke permissions for inactive tabs. Detect this immediately so it appears
  // in Sentry breadcrumbs when users report AV issues.
  useEffect(() => {
    if (!navigator.permissions) return undefined;

    let camPerm = null;
    let micPerm = null;

    const monitorPermissions = async () => {
      try {
        [camPerm, micPerm] = await Promise.all([
          navigator.permissions.query({ name: "camera" }),
          navigator.permissions.query({ name: "microphone" }),
        ]);

        const handlePermChange = (type, permObj) => () => {
          console.warn(
            `[Permissions] ${type} permission changed to: ${permObj.state}`
          );

          if (permObj.state === "denied") {
            console.error(
              `[Permissions] ${type} permission DENIED during call!`
            );
            // This will appear in Sentry breadcrumbs when users report issues
          }
        };

        camPerm.onchange = handlePermChange("camera", camPerm);
        micPerm.onchange = handlePermChange("microphone", micPerm);
      } catch (err) {
        console.warn("[Permissions] Cannot monitor permission changes:", err);
      }
    };

    monitorPermissions();

    return () => {
      // Clean up permission listeners to prevent memory leaks
      if (camPerm) camPerm.onchange = null;
      if (micPerm) micPerm.onchange = null;
    };
  }, []);

  // ------------------- align Daily devices with Empirica preferences ---------------------
  // Make sure that we're using the input devices we selected in the setup stage.
  // This is a bit tricky because the device lists may not be immediately
  // available, and we also need to handle the case where a user has
  // selected a device that is not actually available (anymore).
  // The logic below tries to handle these cases gracefully, but there
  // may still be edge cases that are not covered.
  const devices = useDevices();
  const preferredCameraId = player?.get("cameraId") ?? "waiting";
  const preferredMicId = player?.get("micId") ?? "waiting";
  const updatingMicRef = useRef(false);
  const updatingCameraRef = useRef(false);
  // Track devices we've already logged as unavailable to prevent log spam
  const loggedUnavailableCameraRef = useRef(null);
  const loggedUnavailableMicRef = useRef(null);

  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.()) return;

    // Wait for device lists to be populated before trying to align
    const camerasLoaded = devices?.cameras && devices.cameras.length > 0;
    const microphonesLoaded =
      devices?.microphones && devices.microphones.length > 0;

    const alignCamera = async () => {
      if (
        devices?.cameras?.some(
          (cam) => cam.device.deviceId === preferredCameraId
        )
      ) {
        console.log("Setting camera to preferred", {
          cameraId: preferredCameraId,
        });
        loggedUnavailableCameraRef.current = null; // Reset since we found it
        updatingCameraRef.current = true;
        try {
          if (!callObject.isDestroyed?.()) {
            await callObject.setInputDevicesAsync({
              videoDeviceId: preferredCameraId,
            });
          }
        } finally {
          updatingCameraRef.current = false;
        }
      } else if (loggedUnavailableCameraRef.current !== preferredCameraId) {
        // Only log once per preferred device to prevent spam
        console.log("Preferred camera not available, keeping current camera", {
          preferredCameraId,
          currentCameraId: devices?.currentCam?.device?.deviceId,
          availableCameras: devices?.cameras?.map((c) => c.device.deviceId),
        });
        loggedUnavailableCameraRef.current = preferredCameraId;
      }
    };

    const alignMic = async () => {
      if (
        devices?.microphones?.some(
          (mic) => mic.device.deviceId === preferredMicId
        )
      ) {
        console.log("Setting microphone to preferred", {
          micId: preferredMicId,
        });
        loggedUnavailableMicRef.current = null; // Reset since we found it
        updatingMicRef.current = true;
        try {
          if (!callObject.isDestroyed?.()) {
            await callObject.setInputDevicesAsync({
              audioDeviceId: preferredMicId,
            });
          }
        } finally {
          updatingMicRef.current = false;
        }
      } else if (loggedUnavailableMicRef.current !== preferredMicId) {
        // Only log once per preferred device to prevent spam
        console.log(
          "Preferred microphone not available, keeping current microphone",
          {
            preferredMicId,
            currentMicId: devices?.currentMic?.device?.deviceId,
            availableMicrophones: devices?.microphones?.map(
              (m) => m.device.deviceId
            ),
          }
        );
        loggedUnavailableMicRef.current = preferredMicId;
      }
    };

    if (
      camerasLoaded &&
      preferredCameraId !== "waiting" &&
      updatingCameraRef.current === false &&
      devices?.currentCam?.device?.deviceId !== preferredCameraId
    )
      alignCamera();

    if (
      microphonesLoaded &&
      preferredMicId !== "waiting" &&
      updatingMicRef.current === false &&
      devices?.currentMic?.device?.deviceId !== preferredMicId
    )
      alignMic();
  }, [
    callObject,
    devices,
    preferredCameraId,
    preferredMicId,
    devices?.currentCam?.device?.deviceId,
    devices?.currentMic?.device?.deviceId,
  ]);

  // ------------------- render call surface + tray ---------------------
  // On narrow layouts (< md) the discussion column stacks vertically, so ensure
  // we keep some vertical space reserved for the call; larger breakpoints can
  // continue to stretch based on the surrounding flex layout.

  return (
    <div className="flex h-full w-full flex-col min-h-[320px] md:min-h-0">
      <div className="flex h-full w-full flex-1 flex-col overflow-hidden rounded-xl border border-slate-800/60 bg-slate-950/30 shadow-lg">
        {deviceError ? (
          <UserMediaError error={deviceError} />
        ) : (
          <>
            <div className="flex-1 overflow-hidden">
              <Call
                showNickname={showNickname}
                showTitle={showTitle}
                showSelfView={showSelfView}
                layout={layout}
                rooms={rooms}
              />
            </div>
            <Tray
              showReportMissing={showReportMissing}
              player={player}
              stageElapsed={stageElapsed}
              progressLabel={progressLabel}
              audioContext={audioContext}
            />
          </>
        )}
      </div>
      <DailyAudio onPlayFailed={handleAudioPlayFailed} />
      {(audioPlaybackBlocked || needsUserInteraction) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-sm rounded-lg bg-slate-800 p-6 text-center shadow-xl">
            <p className="mb-4 text-white">
              {audioContextState === "suspended"
                ? "Audio is paused. Click below to enable sound."
                : "Audio playback was blocked by your browser."}
            </p>
            <button
              type="button"
              onClick={handleEnableAudio}
              className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700"
            >
              Enable audio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
