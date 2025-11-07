import React, { useCallback } from "react";
import {
  useAudioTrack,
  useDaily,
  useLocalSessionId,
  useVideoTrack,
} from "@daily-co/daily-react";

import {
  CameraOn,
  CameraOff,
  MicrophoneOff,
  MicrophoneOn,
  MissingParticipant,
} from "./Icons";

import { Button } from "../components/Button";
import { useReportMissing } from "../components/ReportMissing";

export function Tray() {
  const callObject = useDaily();

  const localSessionId = useLocalSessionId();
  const localVideo = useVideoTrack(localSessionId);
  const localAudio = useAudioTrack(localSessionId);
  // Daily's track hooks reflect the *actual* device state, so the buttons stay in sync
  // even when muting happens outside our UI (keyboard shortcut, connection drop, etc.).
  const mutedVideo = localVideo?.isOff ?? false;
  const mutedAudio = localAudio?.isOff ?? false;

  const toggleVideo = useCallback(() => {
    if (!callObject) return;
    // Daily expects `true` to *turn the track on* and `false` to turn it off.
    // `mutedVideo` is `true` when the track is currently off, so passing it
    // straight through flips the state and keeps the button label synced with
    // what users actually experience.
    try {
      callObject.setLocalVideo(mutedVideo);
    } catch (err) {
      console.warn("Failed to toggle video:", err);
    }
  }, [callObject, mutedVideo]);

  const toggleAudio = useCallback(() => {
    if (!callObject) return;
    try {
      callObject.setLocalAudio(mutedAudio);
    } catch (err) {
      console.warn("Failed to toggle audio:", err);
    }
  }, [callObject, mutedAudio]);

  const { openReportMissing } = useReportMissing();

  return (
    <div className="w-full bg-white text-slate-900 shadow-md">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-6 px-6">
        {/*
          Buttons reflect the real device state reported by Daily hooks above.
          That means they stay accurate even when users mute/unmute via keyboard
          shortcuts or automatic bandwidth adjustments.
        */}
        <div className="flex flex-1 items-center gap-4">
          <Button
            primary={false}
            handleClick={toggleVideo}
            testId="toggleVideo"
            className="flex items-center gap-2 whitespace-nowrap px-4 py-3"
          >
            {mutedVideo ? <CameraOff /> : <CameraOn />}
            <span>{mutedVideo ? "Turn camera on" : "Turn camera off"}</span>
          </Button>
          <Button
            primary={false}
            handleClick={toggleAudio}
            testId="toggleAudio"
            className="flex items-center gap-2 whitespace-nowrap px-4 py-3"
          >
            {mutedAudio ? <MicrophoneOff /> : <MicrophoneOn />}
            <span>{mutedAudio ? "Unmute mic" : "Mute mic"}</span>
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center" />
        <div className="flex flex-1 items-center justify-end">
          <Button
            handleClick={openReportMissing}
            testId="reportMissing"
            primary
            className="flex items-center gap-2 whitespace-nowrap px-4 py-3"
          >
            <MissingParticipant />
            <span>Report Missing Participant</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
