import { useStage } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";
import { VideoCall } from "../components/VideoCall";
import { DevConditionalRender } from "../components/ConditionalRender";
import { TextChat } from "../components/TextChat";
import { ReportMissing } from "../components/ReportMissing";
import { useIdleContext } from "../components/IdleProvider";

export function Discussion({ chatType, showNickname, showTitle }) {
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
