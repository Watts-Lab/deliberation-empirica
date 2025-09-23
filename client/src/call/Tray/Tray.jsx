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
} from "./Icons/Icons";
import { Button } from "../../components/Button";
import { useReportMissing } from "../../components/ReportMissing";

export function Tray() {
  const callObject = useDaily();

  const localSessionId = useLocalSessionId();
  const localVideo = useVideoTrack(localSessionId);
  const localAudio = useAudioTrack(localSessionId);
  const mutedVideo = localVideo.isOff;
  const mutedAudio = localAudio.isOff;

  const toggleVideo = useCallback(() => {
    callObject.setLocalVideo(mutedVideo);
  }, [callObject, mutedVideo]);

  const toggleAudio = useCallback(() => {
    callObject.setLocalAudio(mutedAudio);
  }, [callObject, mutedAudio]);

  const { openReportMissing } = useReportMissing();

  return (
    <div className="w-full bg-white text-slate-900 shadow-md">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-6 px-6">
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
