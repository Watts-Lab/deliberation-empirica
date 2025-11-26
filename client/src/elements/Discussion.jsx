import { useStage } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";
// import { VideoCall } from "../components/VideoCall";
import { DevConditionalRender } from "../components/ConditionalRender";
// import { TextChat } from "../components/TextChat";
import { Chat } from "../chat/Chat";
import { ReportMissingProvider } from "../components/ReportMissing";
import { useIdleContext } from "../components/IdleProvider";
import { VideoCall } from "../call/VideoCall";

export function Discussion({
  chatType,
  showNickname,
  showTitle,
  reactionEmojisAvailable,
  reactToSelf,
  numReactionsPerMessage,
}) {
  const stage = useStage();
  const { setAllowIdle } = useIdleContext();

  useEffect(() => {
    // Set allowIdle to true when the component loads
    setAllowIdle(true);
    console.log("Set Allow Idle");

    // Reset allowIdle to false when the component unloads
    return () => {
      setAllowIdle(false);
      console.log("Clear Allow Idle");
    };
  }, [setAllowIdle]);

  useEffect(() => {
    // Log error once when chatType is invalid, not on every render
    if (chatType !== "video" && chatType !== "text") {
      console.error(`Invalid chat type: ${chatType}`);
    }
  }, [chatType]);

  if (chatType !== "video" && chatType !== "text") {
    return null;
  }

  const renderVideoChat = () => (
    <ReportMissingProvider>
      <DevConditionalRender>
        {/* <VideoCall showNickname={showNickname} showTitle={showTitle} record />; */}
        <VideoCall showNickname={showNickname} showTitle={showTitle} />
      </DevConditionalRender>
    </ReportMissingProvider>
  );

  return (
    <div className="relative min-h-sm h-full" data-test="discussion">
      {chatType === "video" && renderVideoChat()}
      {chatType === "text" && (
        <Chat
          scope={stage}
          attribute="chat"
          showNickname={showNickname}
          showTitle={showTitle}
          reactionEmojisAvailable={reactionEmojisAvailable}
          reactToSelf={reactToSelf}
          numReactionsPerMessage={numReactionsPerMessage}
        />
      )}
    </div>
  );
}
