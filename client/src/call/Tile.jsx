/* eslint-disable no-nested-ternary */
import React, { useMemo } from "react";
import {
  DailyVideo,
  useVideoTrack,
  useAudioTrack,
  useParticipantProperty,
} from "@daily-co/daily-react";
import { usePlayer, usePlayers } from "@empirica/core/player/classic/react";
import { MicrophoneOff, CameraOff, ParticipantLeft } from "./Icons";

/**
 * Render an individual participant tile sourced from Daily.
 *
 * The parent component controls sizing via `dimensions`; this component focuses on
 * rendering the video track plus small overlays (local highlight, mute badge,
 * participant name). Keeping it stateless makes it easy to reuse across layouts.
 */

export function Tile({ source, media, pixels }) {
  // ------------------- resolve Empirica + Daily metadata ---------------------
  const players = usePlayers();
  const player = usePlayer();

  const displayPlayer =
    source.type === "self"
      ? player
      : players.find((p) => p.get("position") === String(source.position));
  const dailyId = displayPlayer?.get("dailyId");
  const playerSubmitted = displayPlayer?.stage?.get("submit") || false;

  // ------------------- inspect Daily track state ---------------------
  const videoState = useVideoTrack(dailyId);
  const audioState = useAudioTrack(dailyId);
  const username = useParticipantProperty(dailyId, "user_name"); // disappears if the player disconnects

  // New flags for connection state
  const isVideoConnected = !!videoState;
  const isVideoSubscribed = videoState?.subscribed === true;
  const isVideoMuted = videoState?.isOff;

  const isAudioConnected = !!audioState;
  const isAudioSubscribed = audioState?.subscribed === true;
  const isAudioMuted = audioState?.isOff;

  // ------------------- size tile to layout-provided pixels ---------------------
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

  const positionAttr =
    source.type === "self"
      ? player?.get("position")
      : source.type === "participant"
        ? source.position
        : undefined;

  // ------------------- render tile variants + overlays ---------------------
  return (
    <div
      className={containerClasses}
      style={containerStyle}
      data-test="callTile"
      data-source={source.type}
      data-position={positionAttr != null ? String(positionAttr) : undefined}
    >
      {/* Waiting: not connected (track missing OR not subscribed yet) */}
      {(!isVideoConnected || !isVideoSubscribed) &&
        (!isAudioConnected || !isAudioSubscribed) &&
        !playerSubmitted && <WaitingForParticipantTile />}

      {/* Audio-only: explicitly no video media */}
      {!media?.video && !playerSubmitted && <AudioOnlyTile />}

      {/* Video: connected, subscribed, and not muted */}
      {dailyId &&
        isVideoConnected &&
        isVideoSubscribed &&
        !isVideoMuted &&
        !playerSubmitted && (
          <DailyVideo
            automirror
            sessionId={dailyId}
            className="h-full w-full object-cover"
            type="video"
          />
        )}

      {/* Video mute tile: only if video is connected, subscribed, but muted */}
      {dailyId &&
        isVideoConnected &&
        isVideoSubscribed &&
        isVideoMuted &&
        !playerSubmitted && <VideoMuteTile />}

      {/* Audio mute badge (sits over other tiles): only if audio connected and muted */}
      {dailyId && isAudioConnected && isAudioMuted && !playerSubmitted && (
        <div
          className="absolute right-2 top-2 rounded bg-slate-900/70 p-1 text-red-300"
          aria-label="Participant muted"
        >
          <MicrophoneOff />
        </div>
      )}

      {/* Player left tile: only if the player has left the call */}
      {playerSubmitted && <PlayerLeftTile />}

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
    <div
      className="relative flex h-full w-full items-center justify-center rounded-lg bg-gray-900"
      data-test="videoMutedTile"
    >
      <CameraOff />
      <div className="text-slate-400">Video Muted</div>
    </div>
  );
}

function WaitingForParticipantTile() {
  return (
    <div
      className="relative flex h-full w-full items-center justify-center rounded-lg bg-gray-900"
      data-test="waitingParticipantTile"
    >
      <div className="text-slate-400">
        Waiting for participant to connect...
      </div>
    </div>
  );
}

function AudioOnlyTile() {
  return (
    <div
      className="relative flex h-full w-full items-center justify-center rounded-lg bg-gray-900"
      data-test="audioOnlyTile"
    >
      <div className="text-slate-400">Audio Only</div>
    </div>
  );
}

function PlayerLeftTile() {
  return (
    <div
      className="relative flex h-full w-full items-center justify-center rounded-lg bg-gray-900"
      data-test="participantLeftTile"
    >
      <div className="text-slate-400">Participant has left the call. </div>
      <ParticipantLeft />
    </div>
  );
}
