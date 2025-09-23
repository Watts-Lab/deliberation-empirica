import React, { useMemo } from "react";
import {
  DailyVideo,
  useVideoTrack,
  useAudioTrack,
} from "@daily-co/daily-react";
import { Username } from "./Username";
import { MicrophoneOff } from "./Icons";

/**
 * Render an individual participant tile sourced from Daily.
 *
 * The parent component controls sizing via `dimensions`; this component focuses on
 * rendering the video track plus small overlays (local highlight, mute badge,
 * participant name). Keeping it stateless makes it easy to reuse across layouts.
 */

export function Tile({
  id,
  isScreenShare,
  isLocal,
  showNickname,
  showTitle,
  dimensions,
}) {
  const videoState = useVideoTrack(id);
  const audioState = useAudioTrack(id);
  const isAudioMuted = audioState?.isOff;

  const containerStyle = useMemo(() => {
    if (!dimensions?.width || !dimensions?.height) return undefined;
    return {
      width: `${dimensions.width}px`,
      height: `${dimensions.height}px`,
    };
  }, [dimensions]);

  const containerClasses = [
    "relative h-full w-full overflow-hidden rounded-lg bg-black/80",
    isLocal ? "ring-2 ring-theme-primary" : "",
    videoState.isOff ? "bg-gray-900" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClasses} style={containerStyle}>
      <DailyVideo
        automirror
        sessionId={id}
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
      {!isScreenShare && (
        <Username
          id={id}
          isLocal={isLocal}
          showNickname={showNickname}
          showTitle={showTitle}
        />
      )}
    </div>
  );
}
