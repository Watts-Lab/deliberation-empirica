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
import { useStepElapsedGetter } from "../components/hooks";

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
  const progressLabel = player.get("progressLabel");
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

    joinRoom();

    return () => {
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
  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.()) return undefined;

    const handleDeviceError =
      (type) =>
        (ev = {}) => {
          const rawMessage =
            typeof ev.errorMsg === "string"
              ? ev.errorMsg
              : ev?.errorMsg?.message || ev?.error?.message;

          setDeviceError({
            type,
            message: rawMessage || null,
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

  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.()) return;

    const alignCamera = async () => {
      if (
        devices?.cameras?.some(
          (cam) => cam.device.deviceId === preferredCameraId
        )
      ) {
        console.log("Setting camera to preferred", {
          cameraId: preferredCameraId,
        });
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
      } else {
        console.log("Preferred camera not available, keeping current camera", {
          preferredCameraId,
          currentCameraId: devices?.currentCam?.device?.deviceId,
        });
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
      } else {
        console.log(
          "Preferred microphone not available, keeping current microphone",
          {
            preferredMicId,
            currentMicId: devices?.currentMic?.device?.deviceId,
          }
        );
      }
    };

    if (
      preferredCameraId !== "waiting" &&
      updatingCameraRef.current === false &&
      devices?.currentCam?.device?.deviceId !== preferredCameraId
    )
      alignCamera();

    if (
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
      <DailyAudio />
    </div>
  );
}
