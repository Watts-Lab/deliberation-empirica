import { useStage } from "@empirica/core/player/classic/react";
import React from "react";
import { VideoCall } from "../components/VideoCall";
import { DevConditionalRender } from "../components/Layouts";
import { TextChat } from "../components/TextChat";
import { ReportMissing } from "../components/ReportMissing";

export function Discussion({ chatType, showNickname, showTitle }) {
  const stage = useStage();

  if (chatType !== "video" && chatType !== "text") {
    console.error(`Invalid chat type: ${chatType}`);
    return null;
  }

  const renderVideoChat = () => (
    <>
      <DevConditionalRender>
        <VideoCall showNickname={showNickname} showTitle={showTitle} record />;
      </DevConditionalRender>
      <ReportMissing />
    </>
  );

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
