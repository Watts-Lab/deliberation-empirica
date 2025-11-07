import React, { useEffect, useRef } from "react";
import {
  DailyAudio,
  useDaily,
  useDevices,
  useLocalSessionId,
} from "@daily-co/daily-react";
import { useGame, usePlayer } from "@empirica/core/player/classic/react";

import { Tray } from "./Tray";
import { Call } from "./Call";
import { useDailyEventLogger } from "./hooks/eventLogger";

export function VideoCall({ showNickname, showTitle, layout, rooms }) {
  const game = useGame();
  const player = usePlayer();
  const callObject = useDaily();

  useDailyEventLogger();

  // Set display name in Daily call based on Empirica player data
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

  // Set player position in daily userData for faster matching
  const myPosition = player.get("position");
  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.() || !myPosition) return;
    try {
      const userData = {
        empiricaPosition: myPosition,
      };
      callObject.setUserData(userData);
    } catch (err) {
      console.warn("Failed to set Daily userData", err);
    }
  }, [callObject, myPosition]);

  // Store Daily ID in player data for later matching with video feeds
  // and for displaying participant lists by position.
  const dailyId = useLocalSessionId();

  useEffect(() => {
    if (!dailyId) return;
    if (player.get("dailyId") === dailyId) return;
    console.log("Setting player Daily ID:", dailyId);
    player.set("dailyId", dailyId); // for matching with videos later
    player.append("dailyIds", dailyId); // for displaying by position
  }, [dailyId, player]);

  // Join and leave the Daily room when roomUrl changes
  const roomUrl = game.get("dailyUrl");
  const joiningMeetingRef = useRef(false);

  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.() || !roomUrl) return undefined;

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

  // Align Daily input devices with selected devices from Empirica.
  // This is a bit tricky because the device lists may not be immediately
  // available, and we also need to handle the case where a user has
  // selected a device that is not actually available (anymore).
  //
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

  // On narrow layouts (< md) the discussion column stacks vertically, so ensure
  // we keep some vertical space reserved for the call; larger breakpoints can
  // continue to stretch based on the surrounding flex layout.
  return (
    <div className="flex h-full w-full flex-col min-h-[320px] md:min-h-0">
      <div className="flex h-full w-full flex-1 flex-col overflow-hidden rounded-xl border border-slate-800/60 bg-slate-950/30 shadow-lg">
        <div className="flex-1 overflow-hidden">
          <Call
            showNickname={showNickname}
            showTitle={showTitle}
            layout={layout}
            rooms={rooms}
          />
        </div>
        <Tray />
      </div>
      <DailyAudio />
    </div>
  );
}
