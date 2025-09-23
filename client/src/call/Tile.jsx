import React, { useMemo } from "react";
import { DailyVideo, useVideoTrack } from "@daily-co/daily-react";
import { Username } from "./Username";

export function Tile({
  id,
  isScreenShare,
  isLocal,
  showNickname,
  showTitle,
  dimensions,
}) {
  const videoState = useVideoTrack(id);

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
