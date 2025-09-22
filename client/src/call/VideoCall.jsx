import React, { useEffect } from "react";
import { DailyAudio, useCallObject } from "@daily-co/daily-react";
import { useGame, usePlayer } from "@empirica/core/player/classic/react";

import { Tray } from "./Tray/Tray";
import { Call } from "./Call/Call";

export function VideoCall({ showNickname, showTitle }) {
  const game = useGame();
  const player = usePlayer();
  const callObject = useCallObject();

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
      <div className="flex-1 overflow-hidden">
        <Call showNickname={showNickname} showTitle={showTitle} />
      </div>
      <Tray />
      <DailyAudio />
    </div>
  );
}
