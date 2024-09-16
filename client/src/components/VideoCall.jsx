// Daily Call Object
//
// Todo:
// - [ ] get call connection statistics
//       https://docs.daily.co/reference/daily-js/instance-methods/get-network-stats
//       https://github.com/daily-demos/prebuilt-ui/blob/8e00d42f2c7c932ca9d198aec7c966c3edaed213/index.js#L271-L292
// - [ ] update audio and video sources from what was chosen in hair check
//       https://docs.daily.co/reference/daily-js/instance-methods/cycle-camera
// - [ ] log the stage time when the meeting recording starts
//       https://docs.daily.co/reference/rn-daily-js/events/recording-events
//
//

import {
  usePlayer,
  useStage,
  useGame,
  useStageTimer,
} from "@empirica/core/player/classic/react";
import DailyIframe from "@daily-co/daily-js";
import React, { useState, useRef, useEffect, useReducer } from "react";

export function VideoCall({ showNickname, showTitle }) {
  // empirica objects
  const stageTimer = useStageTimer();
  const player = usePlayer();
  const stage = useStage();
  const game = useGame();
  const progressLabel = player.get("progressLabel");

  // refs
  const dailyElement = useRef(null);

  // state
  const [callFrame, setCallFrame] = useState(null);

  const timestamp = (stageTimer?.elapsed || 0) / 1000;
  const roomUrl = game.get("dailyUrl");
  const displayName = [
    showNickname ? player.get("name") : "",
    showTitle ? player.get("title") : "",
  ]
    .filter((s) => s !== "")
    .join(" - ");

  // const videoSource = player.get("camera");
  // const audioSource = player.get("mic");

  // console.log("Video source: ", videoSource);
  // console.log("Audio source: ", audioSource);

  const reducer = (state, action) => {
    if (!action.type) return state;

    const newState = { ...state };
    const event = {
      position: player.get("position"),
      stage: progressLabel,
      timestamp,
      type: null,
    };

    switch (action.type) {
      case "joined-meeting":
        event.type = "joined-meeting";
        newState.inMeeting = true;
        newState.dailyId = action.dailyId;
        player.append("dailyIds", action.dailyId); // each time we join, we get a new daily ID, keep track of what they all are
        stage.set("callStarted", true); // just in case we are the first to join, trigger server-side action to start recording
        break;

      case "left-meeting":
        event.type = "left-meeting";
        newState.inMeeting = false;
        newState.dailyId = null;
        if (state.currentlySpeaking) {
          newState.currentlySpeaking = false;
          const cumulativeSpeakingTime =
            (player.get("cumulativeSpeakingTime") || 0) +
            (timestamp - player.get("startedSpeakingAt"));
          player.set("cumulativeSpeakingTime", cumulativeSpeakingTime);
          player.set("startedSpeakingAt", null);
        }
        break;

      case "active-speaker-change":
        newState.activeSpeaker = action.activeSpeaker;
        if (
          action.activeSpeaker === state.dailyId &&
          !state.currentlySpeaking
        ) {
          event.type = "started-speaking";
          newState.currentlySpeaking = true;
          player.set("startedSpeakingAt", timestamp);
        } else if (state.currentlySpeaking) {
          event.type = "stopped-speaking";
          newState.currentlySpeaking = false;
          const cumulativeSpeakingTime =
            (player.get("cumulativeSpeakingTime") || 0) +
            (timestamp - player.get("startedSpeakingAt"));
          player.set("cumulativeSpeakingTime", cumulativeSpeakingTime);
          player.set("startedSpeakingAt", null);
        } else {
          return state; // the speaker switched between two other players, do nothing
        }
        break;

      case "participant-updated":
        if (action.participant.video && !state.videoOn) {
          event.type = "unmuted-video";
          newState.videoOn = true;
        } else if (!action.participant.video && state.videoOn) {
          event.type = "muted-video";
          newState.videoOn = false;
        } else if (action.participant.audio && !state.audioOn) {
          event.type = "unmuted-audio";
          newState.audioOn = true;
          if (state.activeSpeaker === state.dailyId) {
            // probably wont happen often
            event.type = "unmuted-audio-as-speaker";
            newState.currentlySpeaking = true;
            player.set("startedSpeakingAt", timestamp);
          }
        } else if (!action.participant.audio && state.audioOn) {
          event.type = "muted-audio";
          newState.audioOn = false;
          if (state.currentlySpeaking) {
            newState.currentlySpeaking = false;
            const cumulativeSpeakingTime =
              (player.get("cumulativeSpeakingTime") || 0) +
              (timestamp - player.get("startedSpeakingAt"));
            player.set("cumulativeSpeakingTime", cumulativeSpeakingTime);
            player.set("startedSpeakingAt", null);
          }
        } else {
          return state; // the participant experienced an irrelevant change
        }
        break;

      default:
        throw new Error(
          `VideoCall reducer: unknown action type ${action.type}`
        );
    }

    stage.append("speakerEvents", event);
    console.log("VideoCall event: ", event);
    console.log("newState", newState);
    return newState;
  };

  const initialState = {
    inMeeting: false,
    activeSpeaker: null,
    currentlySpeaking: false,
    dailyParticipantId: null,
    videoOn: true,
    audioOn: true,
  };

  const [, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    // set user name when both displayName and callFrame are available
    // https://docs.daily.co/reference/daily-js/instance-methods/set-user-name
    if (callFrame && displayName) {
      callFrame.setUserName(displayName);
    }
  }, [callFrame, displayName]);

  useEffect(() => {
    // join the call when both callFrame and roomUrl are available
    if (callFrame && roomUrl) {
      callFrame.join({ url: roomUrl });
    }
  }, [callFrame, roomUrl]); // room URL should be constant for the whole game

  useEffect(() => {
    // mount listeners for daily events
    // https://docs.daily.co/reference/daily-js/events/participant-events
    // https://docs.daily.co/reference/daily-js/events/meeting-events
    if (!callFrame) return;

    callFrame.on("joined-meeting", (event) =>
      dispatch({
        type: "joined-meeting",
        dailyId: event.participants.local.user_id,
      })
    );

    callFrame.on("left-meeting", () => dispatch({ type: "left-meeting" }));

    callFrame.on("active-speaker-change", (event) =>
      dispatch({
        type: "active-speaker-change",
        activeSpeaker: event.activeSpeaker.peerId,
      })
    );

    callFrame.on("participant-updated", (event) =>
      dispatch({ type: "participant-updated", participant: event.participant })
    );

    console.log("Mounted listeners");
  }, [callFrame]);

  useEffect(() => {
    setCallFrame(
      DailyIframe.wrap(dailyElement.current, {
        activeSpeakerMode: false,
      })
    );
    console.log("Created callFrame");
  }, []);

  return (
    <iframe
      id="dailyIframe"
      className="absolute w-full h-full"
      title="Daily Iframe"
      ref={dailyElement}
      allow="microphone;camera;autoplay;display-capture"
    />
  );
}
