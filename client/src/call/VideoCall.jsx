import React, { useEffect, useRef } from "react";
import { DailyAudio, useCallObject, useDevices } from "@daily-co/daily-react";
import { useGame, usePlayer } from "@empirica/core/player/classic/react";

import { Tray } from "./Tray";
import { Call } from "./Call";
import { useDailyEventLogger } from "./hooks/useDailyEventLogger";

export function VideoCall({ showNickname, showTitle }) {
  const game = useGame();
  const player = usePlayer();
  const callObject = useCallObject();
  const devices = useDevices();
  const updatingMicRef = useRef(false);
  const updatingCameraRef = useRef(false);

  useDailyEventLogger();

  const roomUrl = game.get("dailyUrl");
  const preferredCameraId = player?.get("cameraId") ?? "waiting";
  const preferredMicId = player?.get("micId") ?? "waiting";

  // construct display name
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

  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.()) return;
    try {
      callObject.setUserName(displayName || "Guest");
    } catch (err) {
      console.warn("Failed to set Daily username", err);
    }
  }, [callObject, displayName]);

  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.() || !roomUrl) return undefined;

    const joinRoom = async () => {
      try {
        if (
          !callObject.isDestroyed?.() &&
          callObject.meetingState() !== "joined-meeting"
        ) {
          await callObject.join({ url: roomUrl });
        }
      } catch (err) {
        console.error("Error joining Daily call", err);
      }
    };

    joinRoom();

    return () => {
      if (
        !callObject.isDestroyed?.() &&
        callObject.meetingState() !== "left-meeting"
      ) {
        callObject.leave();
      }
    };
  }, [callObject, roomUrl]);

  // Align Daily input devices with selected devices from Empirica.
  // This is a bit tricky because the device lists may not be immediately
  // available, and we also need to handle the case where a user has
  // selected a device that is not actually available (anymore).
  //
  // The logic below tries to handle these cases gracefully, but there
  // may still be edge cases that are not covered.
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
      preferredCameraId !== "waiting " &&
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

  return (
    <div className="flex h-full w-full flex-col">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-1 flex-col overflow-hidden rounded-xl border border-slate-800/60 bg-slate-950/30 shadow-lg">
        <div className="flex-1 overflow-hidden">
          <Call showNickname={showNickname} showTitle={showTitle} />
        </div>
        <Tray />
      </div>
      <DailyAudio />
    </div>
  );
}
