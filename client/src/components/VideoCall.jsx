import {
  usePlayer,
  useStage,
  useStageTimer,
} from "@empirica/core/player/classic/react";
import DailyIframe from "@daily-co/daily-js";
import React, { useEffect, useState, useRef } from "react";

export function VideoCall({ roomUrl, showNickname, showTitle, record }) {
  const player = usePlayer();
  const stage = useStage();
  const stageTimer = useStageTimer();

  const stageElapsed = (stageTimer?.elapsed || 0) / 1000;
  const stageStartedAt = Date.now() / 1000 - stageElapsed;

  const dailyElement = useRef(null);
  const [callFrame, setCallFrame] = useState(null);

  // const speakerEventsAppend = stage.get("speakerEventsAppend") || [];

  const speakerChangeHandler = (event) => {
    /*
    Speakers can change either because:
    - the first speaker joins? (Do we handle this case?)
    -  the active speaker switches to a new participant (active-speaker-change)
    -  because the current participant leaves (participant-left)
    */
    const changeAction = event.action;
    const timestamp = Date.now() / 1000 - stageStartedAt;

    if (
      changeAction === "active-speaker-change" &&
      event.activeSpeaker.peerId === callFrame.participants().local.session_id
    ) {
      // the current participant is speaking
      // event.activeSpeaker.peerId is the daily session id of
      // the participant who has been assigned to the current active speaker by daily
      console.log("I started speaking at", timestamp);
      // log the speaking event to the stage object
      const speakerEvents = stage.get("speakerEvents") || [];
      speakerEvents.push({
        participant: player.id,
        type: "start",
        timestamp,
        method: "active-speaker-change",
      });
      stage.set("speakerEvents", speakerEvents);
      console.log("Stage speakerEvents:", stage.get("speakerEvents") || "none");

      // stage.append("speakerEventsAppend", {
      //   participant: player.id,
      //   type: "start",
      //   timestamp,
      //   method: "active-speaker-change",
      // });
      // console.log("Stage speakerEventsAppend:", speakerEventsAppend);

      // set the player's startedSpeakingAt time to the current time
      player.set("startedSpeakingAt", timestamp);

      return;
    }

    const playerStartedSpeakingAt = player.get("startedSpeakingAt");
    if (!playerStartedSpeakingAt) return; // guard clause

    // continue if a different player takes over as the active speaker
    // or if the current player leaves the meeting
    console.log("I stopped speaking at ", timestamp);

    // log the speaking event to the stage object
    // For now, just log the start events, so that we don't end up with concurrency issues
    // const speakerEvents = stage.get("speakerEvents") || []; // this method can have concurrency issues
    // speakerEvents.push({
    //   participant: player.id,
    //   type: "stop",
    //   timestamp,
    //   method: "active-speaker-change",
    // });
    // stage.set("speakerEvents", speakerEvents);

    // stage.append("speakerEvents", {
    //   participant: player.id,
    //   type: "stop",
    //   timestamp,
    //   method: "active-speaker-change",
    // });
    console.log("Stage speakerEvents:", stage.get("speakerEvents") || "none");

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
    console.log("mounted listeners at ", stageElapsed); // This time gets set as stageElapsed when the handler fires...
  };

  // eslint-disable-next-line consistent-return
  useEffect(() => {
    if (dailyElement.current && !callFrame) {
      // when component starts, only once
      const name = player.get("name") || player.id;
      const title = player.get("title") || "";
      let displayName = player.get("position");
      if (showNickname && showTitle) {
        displayName = `${name} (${title})`;
      } else if (showNickname) {
        displayName = name;
      } else if (showTitle) {
        displayName = title;
      }

      setCallFrame(
        DailyIframe.wrap(dailyElement.current, {
          activeSpeakerMode: false,
          userName: displayName,
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
