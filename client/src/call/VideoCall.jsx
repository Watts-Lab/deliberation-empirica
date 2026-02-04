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
} from "@empirica/core/player/classic/react";

import { Tray } from "./Tray";
import { Call } from "./Call";
import { useDailyEventLogger } from "./hooks/eventLogger";
import { UserMediaError } from "./UserMediaError";
import {
  useProgressLabel,
  useStepElapsedGetter,
} from "../components/ProgressLabelContext";

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

  useDailyEventLogger();

  // ------------------- monitor AudioContext state for autoplay debugging ---------------------
  // Browsers may block audio until user interaction. Log state changes so they appear
  // in Sentry breadcrumbs when a user reports an AV issue.
  useEffect(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return undefined;

    const ctx = new AudioContextClass();
    console.log("[Audio] Initial AudioContext state:", ctx.state);

    const handleStateChange = () => {
      console.log("[Audio] AudioContext state changed:", ctx.state);
    };
    ctx.addEventListener("statechange", handleStateChange);

    return () => {
      ctx.removeEventListener("statechange", handleStateChange);
      ctx.close().catch(() => {}); // ignore errors on close
    };
  }, []);

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
  const getStepElapsed = useStepElapsedGetter();

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
      stageElapsed: getStepElapsed(),
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
    // The DailyAudio component will retry on its own when tracks update,
    // but we can also try to resume any suspended audio contexts.
    setAudioPlaybackBlocked(false);
    // Try to resume audio context if it exists
    if (window.AudioContext || window.webkitAudioContext) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass();
      ctx.resume().then(() => ctx.close());
    }
  }, []);

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
            <Tray showReportMissing={showReportMissing} />
          </>
        )}
      </div>
      <DailyAudio onPlayFailed={handleAudioPlayFailed} />
      {audioPlaybackBlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-sm rounded-lg bg-slate-800 p-6 text-center shadow-xl">
            <p className="mb-4 text-white">
              Audio playback was blocked by your browser.
            </p>
            <button
              type="button"
              onClick={handleEnableAudio}
              className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700"
            >
              Click to enable audio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
