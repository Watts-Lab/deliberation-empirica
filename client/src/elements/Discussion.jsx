import { useStage } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";
import { DevConditionalRender } from "../components/ConditionalRender";
import { Chat } from "../chat/Chat";
import { ReportMissingProvider } from "../call/ReportMissing";
import { useIdleContext } from "../components/IdleProvider";
import { VideoCall } from "../call/VideoCall";

export function Discussion({
  chatType,
  showNickname,
  showTitle,
  showSelfView = true,
  showReportMissing = true,
  layout,
  rooms,
  reactionEmojisAvailable,
  reactToSelf,
  numReactionsPerMessage,
}) {
  const stage = useStage();
  const { setAllowIdle } = useIdleContext();

  useEffect(() => {
    if (chatType !== "text") {
      // Video and audio calls should not trigger idle state
      // as participant may be there, but not using the mouse/keyboard
      setAllowIdle(true);
      console.log("Set Allow Idle");
    }

    // Reset allowIdle to false when the component unloads (it's fine if already false)
    return () => {
      setAllowIdle(false);
      console.log("Clear Allow Idle");
    };
  }, [setAllowIdle, chatType]);

  useEffect(() => {
    // Log error once when chatType is invalid, not on every render
    if (chatType !== "video" && chatType !== "text") {
      console.error(`Invalid chat type: ${chatType}`);
    }
  }, [chatType]);

  if (chatType !== "video" && chatType !== "text") {
    return null;
  }

  return (
    <div className="relative min-h-sm h-full" data-test="discussion">
      {chatType === "video" && (
        <ReportMissingProvider>
          <DevConditionalRender>
            <VideoCall
              showNickname={showNickname}
              showTitle={showTitle}
              showSelfView={showSelfView}
              showReportMissing={showReportMissing}
              layout={layout}
              rooms={rooms}
            />
          </DevConditionalRender>
        </ReportMissingProvider>
      )}
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
