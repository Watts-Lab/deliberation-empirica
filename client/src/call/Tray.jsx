import React, { useCallback, useState } from "react";
import {
  useAudioTrack,
  useAudioLevelObserver,
  useDaily,
  useLocalSessionId,
  useVideoTrack,
} from "@daily-co/daily-react";

import {
  CameraOn,
  CameraOff,
  MicrophoneOff,
  MicrophoneWithLevel,
  MissingParticipant,
  Wrench,
} from "./Icons";
import { transformAudioLevel } from "./utils/audioLevelUtils";

import { Button } from "../components/Button";
import { useReportMissing } from "./ReportMissing";
import { useFixAV } from "./FixAV";

export function Tray({
  showReportMissing = true,
  player,
  stageElapsed,
  progressLabel,
  audioContext,
  resumeAudioContext,
}) {
  // ------------------- read Daily device state ---------------------
  const callObject = useDaily();

  const localSessionId = useLocalSessionId();
  const localVideo = useVideoTrack(localSessionId);
  const localAudio = useAudioTrack(localSessionId);
  // Daily's track hooks reflect the *actual* device state, so the buttons stay in sync
  // even when muting happens outside our UI (keyboard shortcut, connection drop, etc.).
  const mutedVideo = localVideo?.isOff ?? false;
  const mutedAudio = localAudio?.isOff ?? false;

  // ------------------- audio level monitoring ---------------------
  const [audioLevel, setAudioLevel] = useState(0);

  // Only observe audio levels when unmuted to avoid unnecessary updates
  useAudioLevelObserver(
    localSessionId,
    useCallback(
      (rawVolume) => {
        if (!mutedAudio) {
          setAudioLevel(transformAudioLevel(rawVolume));
        }
      },
      [mutedAudio]
    )
  );

  // ------------------- toggle handlers ---------------------
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
  const { openFixAV, FixAVModal } = useFixAV(
    player,
    stageElapsed,
    progressLabel,
    audioContext,
    resumeAudioContext
  );

  // ------------------- render tray controls ---------------------
  return (
    <div className="w-full bg-white text-slate-900 shadow-md">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-2 px-6 sm:gap-3">
        {/*
          Buttons reflect the real device state reported by Daily hooks above.
          That means they stay accurate even when users mute/unmute via keyboard
          shortcuts or automatic bandwidth adjustments.
        */}
        <Button
          primary={false}
          handleClick={toggleVideo}
          testId="toggleVideo"
          className="flex h-[3rem] items-center gap-2 pl-1 pr-2 py-2 sm:pl-2 sm:pr-4"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
            {mutedVideo ? <CameraOff /> : <CameraOn />}
          </div>
          <span className="whitespace-normal">{mutedVideo ? "Enable camera" : "Disable camera"}</span>
        </Button>
        <Button
          primary={false}
          handleClick={toggleAudio}
          testId="toggleAudio"
          className="flex h-[3rem] items-center gap-2 pl-1 pr-2 py-2 sm:pl-2 sm:pr-4"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
            {mutedAudio ? (
              <MicrophoneOff />
            ) : (
              <MicrophoneWithLevel level={audioLevel} />
            )}
          </div>
          <span className="whitespace-normal">{mutedAudio ? "Unmute mic" : "Mute mic"}</span>
        </Button>
        <Button
          primary={false}
          handleClick={openFixAV}
          testId="fixAV"
          className="flex h-[3rem] items-center gap-2 pl-1 pr-2 py-2 text-sm sm:pl-2 sm:pr-4"
        >
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
            <Wrench />
          </div>
          <span className="whitespace-normal">Fix Audio/Video</span>
        </Button>
        {showReportMissing && (
          <Button
            handleClick={openReportMissing}
            testId="reportMissing"
            primary
            className="flex h-[3rem] items-center gap-2 pl-1 pr-2 py-2 sm:pl-2 sm:pr-4"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
              <MissingParticipant />
            </div>
            <span className="whitespace-normal">Missing Participant</span>
          </Button>
        )}
      </div>

      <FixAVModal />
    </div>
  );
}
