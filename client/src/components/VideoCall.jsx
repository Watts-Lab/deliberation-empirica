/* eslint-disable no-param-reassign */
import { usePlayer, useStage } from "@empirica/core/player/classic/react";
import DailyIframe from "@daily-co/daily-js";
import React, { useEffect } from "react";

export function VideoCall({ dailyElement: callFrame, dailyIframe, roomUrl, record }) {
  const player = usePlayer();
  const stage = useStage();

  // don't call this until roomKey Exists
  // const dailyIframe = useRef(null);

  const mountListeners = () => {
    callFrame.current.on("joined-meeting", (event) => {
      console.debug("Joined Meeting", event);
      const dailyIds = player.get("dailyIds");
      const newIds = {};
      newIds[stage.id] = event.participants.local.user_id;
      if (!dailyIds) {
        player.set("dailyIds", newIds);
      } else {
        player.set("dailyIds", { ...newIds, ...dailyIds });
      }
      if (record && !stage.get("recorded")) {
        callFrame.current.startRecording();
        stage.set("recorded", true);
      }
    });

    callFrame.current.on("track-started", (event) => {
      // Why are these not triggering correctly???
      if (event.participant.local) {
        if (event.track.kind === "video") {
          player.set("videoEnabled", true);
          console.debug("player video started");
        } else if (event.track.kind === "audio") {
          player.set("audioEnabled", true);
          console.debug("player audio started");
        }
        console.debug("track-started", event);
      }
    });

    callFrame.current.on("track-stopped", (event) => {
      // Same here???
      if (event.participant.local) {
        if (event.track.kind === "video") {
          player.set("videoEnabled", false);
          console.debug("player video stopped");
        } else if (event.track.kind === "audio") {
          player.set("audioEnabled", false);
          console.debug("player audio stopped");
        }
        console.debug("track-started", event);
      }
    });
  };

  // eslint-disable-next-line consistent-return
  useEffect(() => {
    if (dailyIframe.current && !callFrame.current) {
      // when component starts, only once
      callFrame.current = 
        DailyIframe.wrap(dailyIframe.current, {
          activeSpeakerMode: false,
          userName: player.get("nickname"),
          videoSource: player.get("camera"),
          audioSource: player.get("mic"),
        });
      console.log("mounted callFrame");
      mountListeners();
    }
  }, [dailyIframe, callFrame]);

  useEffect(() => {
    if (callFrame.current && roomUrl) {
        callFrame.current.join({ url: roomUrl });
    }

    // return () => {
    //   console.log("left meeting");
    //   // when component closes
    //   if (callFrame.current) {
    //     // callFrame.stopRecording();
    //     callFrame.current.leave();
    //   }
    // };
  }, [roomUrl]);

  return (
    <div>
      <iframe
        id="dailyIframe"
        className="absolute w-full h-full"
        title="Daily Iframe"
        ref={dailyIframe}
        allow="microphone;camera;autoplay;display-capture"
      />
    </div>
  );
}
