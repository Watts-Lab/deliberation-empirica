import {
  usePlayer,
  useStage,
  useStageTimer,
} from "@empirica/core/player/classic/react";
import DailyIframe from "@daily-co/daily-js";
import React, { useEffect, useState, useRef } from "react";

export function VideoCall({ roomUrl, record }) {
  const player = usePlayer();
  const stage = useStage();
  const stageTimer = useStageTimer();

  const dailyElement = useRef(null);
  const [callFrame, setCallFrame] = useState(null);

  const speakerChangeHandler = (event) => {
    /*
    Speakers can change either because:
    -  the active speaker switches to a new participant (active-speaker-change)
    -  because the current participant leaves (participant-left)
    */

    const timestamp = stageTimer?.elapsed;
    // TODO: guard clause here if timestamp is null?
    // or, find a default value for timestamp? fallback value?

    const changeAction = event.action;

    if (
      changeAction === "active-speaker-change" &&
      event.activeSpeaker.peerId === callFrame.participants().local.session_id
    ) {
      // the current participant is speaking
      // event.activeSpeaker.peerId is the daily session id of
      // the participant who has been assigned to the current active speaker by daily
      console.log("I'm speaking");
      // log the speaking event to the stage object
      stage.append("speakerEvents", {
        participant: player.id,
        type: "start",
        timestamp,
        method: "active-speaker-change",
      });

      // set the player's startedSpeakingAt time to the current time
      player.set("startedSpeakingAt", stageTimer?.elapsed);

      return;
    }

    const playerStartedSpeakingAt = player.get("startedSpeakingAt");
    if (!playerStartedSpeakingAt) return; // guard clause

    // continue if a different player takes over as the active speaker
    // or if the current player leaves the meeting
    console.log("I stopped speaking");

    // log the speaking event to the stage object
    stage.append("speakerEvents", {
      participant: player.id,
      type: "stop",
      timestamp,
      method: "active-speaker-change",
    });

    // update the player object
    const prevCumulative = player.get("cumulativeSpeakingTime") || 0;
    const speakingTime = timestamp - playerStartedSpeakingAt;
    player.set("cumulativeSpeakingTime", prevCumulative + speakingTime);

    // reset the player's startedSpeakingAt time, as they are no longer speaking
    player.set("startedSpeakingAt", null);
  };

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

    callFrame.on("active-speaker-change", speakerChangeHandler);
    callFrame.on("participant-left", speakerChangeHandler);
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
