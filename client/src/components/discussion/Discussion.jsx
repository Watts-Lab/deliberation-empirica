import { useStage } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";
import { DevConditionalRender } from "../ConditionalRender";
import { Chat } from "./chat/Chat";
import { ReportMissingProvider } from "./call/ReportMissing";
import { useAllowIdle } from "../IdleProvider";
import { VideoCall } from "./call/VideoCall";

export function Discussion({ discussion }) {
  const {
    chatType,
    showNickname = true,
    showTitle,
    showSelfView = true,
    showReportMissing = true,
    showAudioMute = true,
    showVideoMute = true,
    layout,
    rooms,
    reactionEmojisAvailable = [],
    reactToSelf = true,
    numReactionsPerMessage = 1,
  } = discussion;

  const stage = useStage();
  // Video/audio calls should not trigger idle — participant may be engaged
  // without mouse/keyboard activity. Text chat requires typing, so keep idle
  // detection on.
  useAllowIdle(chatType !== "text");

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
    <div className="relative min-h-sm h-full" data-testid="discussion">
      {chatType === "video" && (
        <ReportMissingProvider>
          <DevConditionalRender>
            <VideoCall
              showNickname={showNickname}
              showTitle={showTitle}
              showSelfView={showSelfView}
              showReportMissing={showReportMissing}
              showAudioMute={showAudioMute}
              showVideoMute={showVideoMute}
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
