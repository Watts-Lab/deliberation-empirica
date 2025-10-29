import React, { useMemo } from "react";
import {
  DailyVideo,
  useVideoTrack,
  useAudioTrack,
} from "@daily-co/daily-react";
import { usePlayer, usePlayers } from "@empirica/core/player/classic/react";
import { Username } from "./Username";
import { MicrophoneOff } from "./Icons";

/**
 * Render an individual participant tile sourced from Daily.
 *
 * The parent component controls sizing via `dimensions`; this component focuses on
 * rendering the video track plus small overlays (local highlight, mute badge,
 * participant name). Keeping it stateless makes it easy to reuse across layouts.
 */

export function Tile({ source, media, pixels, showNickname, showTitle }) {
  const players = usePlayers();
  const player = usePlayer();

  const displayPlayer =
    source.type === "self"
      ? player
      : players.find((p) => p.get("position") === source.position);
  const dailyId = displayPlayer?.get("dailyId");

  const videoState = useVideoTrack(dailyId);
  const audioState = useAudioTrack(dailyId);
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
    videoState.isOff ? "bg-gray-900" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClasses} style={containerStyle}>
      <DailyVideo
        automirror
        sessionId={dailyId}
        className="h-full w-full object-cover"
        type="video"
      />
      {isAudioMuted && (
        <div
          className="absolute right-2 top-2 rounded bg-slate-900/70 p-1 text-red-300"
          aria-label="Participant muted"
        >
          <MicrophoneOff />
        </div>
      )}

      <Username
        id={dailyId}
        isLocal={source.type === "self"}
        showNickname={showNickname}
        showTitle={showTitle}
      />
    </div>
  );
}
