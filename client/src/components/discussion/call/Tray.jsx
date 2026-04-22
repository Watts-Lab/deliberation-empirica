import React, { useCallback, useEffect, useState } from "react";
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
import { TrayButton } from "./TrayButton";
import { transformAudioLevel } from "./utils/audioLevelUtils";
import { useReportMissing } from "./ReportMissing";
import { useFixAV } from "./FixAV";

export function Tray({
  showReportMissing = true,
  showAudioMute = true,
  showVideoMute = true,
  player,
  stageElapsed,
  progressLabel,
  audioContext,
  resumeAudioContext,
  roomUrl,
  fixAVRef,
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
  const { openFixAV, fixAVModal } = useFixAV(
    player,
    stageElapsed,
    progressLabel,
    audioContext,
    resumeAudioContext,
    roomUrl,
    mutedAudio ? 0 : audioLevel
  );

  // Expose openFixAV to parent via ref so banners can trigger it
  useEffect(() => {
    if (fixAVRef) {
      fixAVRef.current = openFixAV; // eslint-disable-line no-param-reassign
    }
  }, [openFixAV, fixAVRef]);

  // ------------------- render tray controls ---------------------
  return (
    <div className="w-full bg-white text-slate-900 shadow-md">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-2 px-6 sm:gap-3">
        {/*
          Buttons reflect the real device state reported by Daily hooks above.
          That means they stay accurate even when users mute/unmute via keyboard
          shortcuts or automatic bandwidth adjustments.
        */}
        {showVideoMute && (
          <TrayButton
            onClick={toggleVideo}
            data-testid="toggleVideo"
            icon={mutedVideo ? <CameraOff /> : <CameraOn />}
          >
            {mutedVideo ? "Enable camera" : "Disable camera"}
          </TrayButton>
        )}
        {showAudioMute && (
          <TrayButton
            onClick={toggleAudio}
            data-testid="toggleAudio"
            icon={
              mutedAudio ? (
                <MicrophoneOff />
              ) : (
                <MicrophoneWithLevel level={audioLevel} />
              )
            }
          >
            {mutedAudio ? "Unmute mic" : "Mute mic"}
          </TrayButton>
        )}
        <TrayButton
          onClick={openFixAV}
          data-testid="fixAV"
          icon={<Wrench />}
        >
          Fix Audio/Video
        </TrayButton>
        {showReportMissing && (
          <TrayButton
            onClick={openReportMissing}
            data-testid="reportMissing"
            primary
            icon={<MissingParticipant />}
          >
            Missing Participant
          </TrayButton>
        )}
      </div>

      {fixAVModal}
    </div>
  );
}
