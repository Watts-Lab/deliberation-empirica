import { usePlayer, useStage } from "@empirica/core/player/classic/react";
import DailyIframe from "@daily-co/daily-js";
import React, { useEffect, useState, useRef } from "react";

export function VideoCall({ roomUrl, record }) {
  const player = usePlayer();
  const stage = useStage();

  const dailyElement = useRef(null);
  const [callFrame, setCallFrame] = useState(null);
//  const meetingStartTime = Date.now();
  let lastSpeaker = "";

  function logEndTime() {
    const speakerEvents = player.get("speakerEvents") || [];
    const timestamp = Date.now();
    let currentCumulative = 0;
    if (speakerEvents.length !== 0) {
      currentCumulative = speakerEvents[speakerEvents.length-1].cumulative;
    }
    if (lastSpeaker === callFrame.participants().local.session_id) {
      console.log("find last speaker");
      const speakerEvent = {
        "type": "stop",
        "timestamp": timestamp,
        "cumulative": currentCumulative + (timestamp - speakerEvents[speakerEvents.length-1].timestamp) / 1000,
      };
      player.set("speakerEvents", [...speakerEvents, speakerEvent]);
    }
  }

  const mountListeners = () => {
    callFrame.on("joined-meeting", (event) => {
      const currentDailyId = event.participants.local.user_id;
      const playerDailyIds = player.get("dailyIds") || [];
      player.set("dailyIds", [...playerDailyIds, currentDailyId]);

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
      // console.log("active speaker change");
      logEndTime();
      
      const speakerEvents = player.get("speakerEvents") || [];
      stage.set("currentSpeaker", event.activeSpeaker.peerId);
      const timestamp = Date.now();
      let currentCumulative = 0;
      if (speakerEvents.length !== 0) {
        currentCumulative = speakerEvents[speakerEvents.length-1].cumulative;
      }
      if (event.activeSpeaker.peerId === callFrame.participants().local.session_id) {
        // console.log("Im speaking");
        const speakerEvent = {
          "type": "start",
          "timestamp": timestamp,
          "cumulative": currentCumulative,
        };
        player.set("speakerEvents", [...speakerEvents, speakerEvent]);
       // player.append("speakerEvents", speakerEvent);
       lastSpeaker = event.activeSpeaker.peerId;
      } 
      console.log(player.get("speakerEvents"));
    }); 

    callFrame.on("participant-left", (event) => {
      if (event) {
        logEndTime();
      }
    });
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
