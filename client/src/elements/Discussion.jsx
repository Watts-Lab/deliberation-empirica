import { useGame, useStage, Chat } from "@empirica/core/player/classic/react";
import React from "react";
import { VideoCall } from "../components/VideoCall";
import { H3 } from "../components/TextStyles";
import { DevConditionalRender } from "../components/Layouts";

export function Discussion({ chatType }) {
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
        <VideoCall roomUrl={dailyUrl} record />;
      </DevConditionalRender>
    );
  };

  return (
    <div className="relative min-h-sm h-full" data-test="discussion">
      {chatType === "video" && renderVideoChat()}
      {chatType === "text" && <Chat scope={stage} attribute="textChat" />}
    </div>
  );
}
