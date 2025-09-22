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
      <div className="mx-auto flex h-20 max-w-5xl items-center gap-8 px-6">
        <div className="flex flex-1 items-center gap-6">
          <button
            onClick={toggleVideo}
            type="button"
            className="flex flex-col items-center text-sm font-medium"
          >
            {mutedVideo ? <CameraOff /> : <CameraOn />}
            {mutedVideo ? "Turn camera on" : "Turn camera off"}
          </button>
          <button
            onClick={toggleAudio}
            type="button"
            className="flex flex-col items-center text-sm font-medium"
          >
            {mutedAudio ? <MicrophoneOff /> : <MicrophoneOn />}
            {mutedAudio ? "Unmute mic" : "Mute mic"}
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Button
            handleClick={openReportMissing}
            testId="reportMissing"
            className="inline-flex"
          >
            Report Missing Participant
          </Button>
        </div>
      </div>
    </div>
  );
}
