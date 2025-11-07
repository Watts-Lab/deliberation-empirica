import React, { useMemo } from "react";
import {
  DailyVideo,
  useVideoTrack,
  useAudioTrack,
  useParticipantProperty,
} from "@daily-co/daily-react";
import { usePlayer, usePlayers } from "@empirica/core/player/classic/react";
import { MicrophoneOff, CameraOff } from "./Icons";

/**
 * Render an individual participant tile sourced from Daily.
 *
 * The parent component controls sizing via `dimensions`; this component focuses on
 * rendering the video track plus small overlays (local highlight, mute badge,
 * participant name). Keeping it stateless makes it easy to reuse across layouts.
 */

export function Tile({ source, media, pixels }) {
  const players = usePlayers();
  const player = usePlayer();

  const displayPlayer =
    source.type === "self"
      ? player
      : players.find((p) => p.get("position") === String(source.position));
  const dailyId = displayPlayer?.get("dailyId");

  const videoState = useVideoTrack(dailyId);
  const audioState = useAudioTrack(dailyId);
  const username = useParticipantProperty(dailyId, "user_name"); // disappears if the player disconnects

  // New flags for connection state
  const isVideoConnected = !!videoState;
  const isVideoMuted = videoState?.isOff;
  const isAudioConnected = !!audioState;
  const isAudioMuted = audioState?.isOff;

  const containerStyle = useMemo(() => {
    if (!pixels?.width || !pixels?.height) return undefined;
    return {
      width: `${pixels.width}px`,
      height: `${pixels.height}px`,
    };
  }, [pixels]);

  const containerClasses = [
    "relative h-full w-full overflow-hidden rounded-lg bg-black/80",
    source.type === "self" ? "ring-2 ring-theme-primary" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClasses} style={containerStyle}>
      {/* Waiting: not connected (track missing) */}
      {!isVideoConnected && !isAudioConnected && <WaitingForParticipantTile />}

      {/* Audio-only: explicitly no video media */}
      {!media?.video && <AudioOnlyTile />}

      {/* Video: connected and not muted */}
      {dailyId && isVideoConnected && !isVideoMuted && (
        <DailyVideo
          automirror
          sessionId={dailyId}
          className="h-full w-full object-cover"
          type="video"
        />
      )}

      {/* Video mute tile: only if video is connected and muted */}
      {dailyId && isVideoConnected && isVideoMuted && <VideoMuteTile />}

      {/* Audio mute badge (sits over other tiles): only if audio connected and muted */}
      {dailyId && isAudioConnected && isAudioMuted && (
        <div
          className="absolute right-2 top-2 rounded bg-slate-900/70 p-1 text-red-300"
          aria-label="Participant muted"
        >
          <MicrophoneOff />
        </div>
      )}
      {/* Username badge (sits over other tiles) */}
      {username && (
        <div className="absolute bottom-2 left-2 z-10 rounded bg-slate-900/80 px-2 py-1 text-xs font-medium text-slate-100">
          {username} {source.type === "self" && "(you)"}
        </div>
      )}
    </div>
  );
}

function VideoMuteTile() {
  return (
    <div className="relative flex h-full w-full items-center justify-center rounded-lg bg-gray-900">
      <CameraOff />
      <div className="text-slate-400">Video Muted</div>
    </div>
  );
}

function WaitingForParticipantTile() {
  return (
    <div className="relative flex h-full w-full items-center justify-center rounded-lg bg-gray-900">
      <div className="text-slate-400">
        Waiting for participant to connect...
      </div>
    </div>
  );
}

function AudioOnlyTile() {
  return (
    <div className="relative flex h-full w-full items-center justify-center rounded-lg bg-gray-900">
      <div className="text-slate-400">Audio Only</div>
    </div>
  );
}
