import React, { useEffect } from "react";
import { DailyAudio, useCallObject } from "@daily-co/daily-react";
import { useGame, usePlayer } from "@empirica/core/player/classic/react";

import { Tray } from "./Tray";
import { Call } from "./Call";
import { useDailyEventLogger } from "./hooks/useDailyEventLogger";

export function VideoCall({ showNickname, showTitle }) {
  const game = useGame();
  const player = usePlayer();
  const callObject = useCallObject();

  useDailyEventLogger();

  const roomUrl = game.get("dailyUrl");

  // construct display name
  let displayName = "";
  if (showNickname && player.get("name")) {
    displayName += player.get("name");
  }
  if (showTitle && player.get("title")) {
    if (displayName) {
      displayName += " - ";
    }
    displayName += player.get("title");
  }

  useEffect(() => {
    if (callObject) {
      callObject.setUserName(displayName || "Guest");
    }
  }, [callObject, displayName]);

  useEffect(() => {
    if (callObject && roomUrl) {
      callObject.join({ url: roomUrl });
    }
    return () => {
      if (callObject) {
        callObject.leave();
      }
    };
  }, [callObject, roomUrl]);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-1 flex-col overflow-hidden rounded-xl border border-slate-800/60 bg-slate-950/30 shadow-lg">
        <div className="flex-1 overflow-hidden">
          <Call showNickname={showNickname} showTitle={showTitle} />
        </div>
        <Tray />
      </div>
      <DailyAudio />
    </div>
  );
}
