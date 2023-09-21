import { useGame, useStage } from "@empirica/core/player/classic/react";
import React from "react";
import { VideoCall } from "../components/VideoCall";
import { H3 } from "../components/TextStyles";
import { DevConditionalRender } from "../components/Layouts";
import { TextChat } from "../components/TextChat";

export function Discussion({ chatType, showNickname, showTitle }) {
  const game = useGame();
  const stage = useStage();

  if (chatType !== "video" && chatType !== "text") {
    console.error(`Invalid chat type: ${chatType}`);
    return null;
  }

  const renderVideoChat = () => {
    const dailyUrl = game.get("dailyUrl");
    if (!dailyUrl)
      return (
        <H3> Loading meeting room. This should take ~30 seconds or less. </H3>
      );

    return (
      <DevConditionalRender>
        <VideoCall
          roomUrl={dailyUrl}
          showNickname={showNickname}
          showTitle={showTitle}
          record
        />
        ;
      </DevConditionalRender>
    );
  };

  return (
    <div className="relative min-h-sm h-full" data-test="discussion">
      {chatType === "video" && renderVideoChat()}
      {chatType === "text" && (
        <TextChat
          scope={stage}
          attribute="textChat"
          showNickname={showNickname}
          showTitle={showTitle}
        />
      )}
    </div>
  );
}
