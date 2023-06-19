import { usePlayer, useStage } from "@empirica/core/player/classic/react";
import DailyIframe from "@daily-co/daily-js";
import React, { useEffect, useState, useRef } from "react";

export function VideoCall({ roomUrl, record }) {
  const player = usePlayer();
  const stage = useStage();

  const dailyElement = useRef(null);
  const [callFrame, setCallFrame] = useState(null);
  const meetingStartTime = Date.now();

  const mountListeners = () => {
    callFrame.on("joined-meeting", (event) => {
      const currentDailyId = event.participants.local.user_id;
      const playerDailyIds = player.get("dailyIds") || [];
      const playerSpeakTime = [];
      player.set("dailyIds", [...playerDailyIds, {currentDailyId, playerSpeakTime }]);

      if (record && !stage.get("recorded")) {
        callFrame.startRecording();
        stage.set("recorded", true);
      }
    });

    callFrame.on("track-started", (event) => {
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

    callFrame.on("track-stopped", (event) => {
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

    callFrame.on("active-speaker-change", (event) => {
      const currentSpeakerSessionId = event.activeSpeaker.peerId;
      const currentSpeakerUserId = callFrame.participants()[currentSpeakerSessionId].user_id
                                  || callFrame.participants().local.user_id;
      const currentStartTime = Date.now() - meetingStartTime; // unit: milliseconds
      const currentSpeakerTimes = player.get("dailyIds")[currentSpeakerUserId].playerSpeakTime;
      player.set("dailyIds"[player.get("dailyIds").size()-1].playerSpeakTime.endTime, currentStartTime);
      player.set("dailyIds"[currentSpeakerUserId].playerSpeakTime, 
                [...currentSpeakerTimes, {"startTime": currentStartTime, "endTime": "waiting"}]);
      console.log(player.get("dailyIds"));
    }) 
  }; 

  // eslint-disable-next-line consistent-return
  useEffect(() => {
    if (dailyElement.current && !callFrame) {
      // when component starts, only once
      setCallFrame(
        DailyIframe.wrap(dailyElement.current, {
          activeSpeakerMode: false,
          userName: player.get("nickname"),
          videoSource: player.get("camera"),
          audioSource: player.get("mic"),
        })
      );
      console.log("mounted callFrame");
    }
  }, [dailyElement, callFrame]);

  useEffect(() => {
    if (callFrame) {
      mountListeners();
      callFrame.join({ url: roomUrl });
    }

    return () => {
      console.log("left meeting");
      // when component closes
      if (callFrame) {
        // callFrame.stopRecording();
        callFrame.leave();
      }
    };
  }, [callFrame]);

  return (
    <div>
      <iframe
        id="dailyIframe"
        className="absolute w-full h-full"
        title="Daily Iframe"
        ref={dailyElement}
        allow="microphone;camera;autoplay;display-capture"
      />
    </div>
  );
}
