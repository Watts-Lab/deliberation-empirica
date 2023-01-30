import { usePlayer, useStage } from "@empirica/core/player/classic/react";
import DailyIframe from "@daily-co/daily-js";
import React, { useEffect, useState, useRef } from "react";

export function VideoCall({ roomUrl, record }) {
  const player = usePlayer();
  const stage = useStage();

  // don't call this until roomKey Exists
  const dailyElement = useRef(null);
  const [callFrame, setCallFrame] = useState(null);

  const mountListeners = () => {
    callFrame.on("joined-meeting", (event) => {
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
        callFrame.startRecording();
        stage.set("recorded", true);
      }
      // Temporary Fix: Manually set devices to saved config on join
      setTimeout(() => {
        console.log("attempt switching device setting")
        callFrame.setInputDevicesAsync({
          videoDeviceId: player.get("camera"),
          audioDeviceId: player.get("mic"),
        })}
      , 5000);
    });

    callFrame.on("track-started", (event) => {
      console.log("track-event detected")
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
    if (dailyElement.current && !callFrame) {
      // when component starts, only once
      console.log(player.get("camera"))
      console.log(player.get("mic"))
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
      console.log(player.get("camera"))
      console.log(player.get("mic"))
      callFrame.join({
        url: roomUrl,
        videoSource: player.get("camera"),
        audioSource: player.get("mic"),
      });
    }

    return () => {
      // when component closes
      if (callFrame) {
        console.log("left meeting");
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
