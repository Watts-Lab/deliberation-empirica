// Daily Call Object
//
// Todo:
// - [ ] get call connection statistics
//       https://docs.daily.co/reference/daily-js/events/quality-events#network-quality-change
//       https://docs.daily.co/reference/daily-js/instance-methods/get-network-stats
//       https://github.com/daily-demos/prebuilt-ui/blob/8e00d42f2c7c932ca9d198aec7c966c3edaed213/index.js#L271-L292
// - [ ] update audio and video sources from what was chosen in hair check
//       note that we can't do this while using daily iframe, because the
//       browser assigns different ids to the webcam and mic in the iframe (for security)
//       we would need to scrap using daily prebuilt and roll our own UI
//       https://docs.daily.co/reference/daily-js/instance-methods/cycle-camera
// - [ ] log the stage time when the meeting recording starts
//       https://docs.daily.co/reference/rn-daily-js/events/recording-events

import {
  usePlayer,
  useStage,
  useGame,
  useStageTimer,
} from "@empirica/core/player/classic/react";
import {
  DailyProvider,
  useCallFrame,
  useMeetingState,
} from "@daily-co/daily-react";
import React, { useRef, useEffect, useReducer } from "react";

export function VideoCall({ showNickname, showTitle }) {
  // empirica hooks
  const stageTimer = useStageTimer();
  const player = usePlayer();
  const stage = useStage();
  const game = useGame();

  // daily hooks
  const callRef = useRef(null);
  const callFrame = useCallFrame({
    parentElRef: callRef,
    options: {
      iframeStyle: {
        position: "absolute",
        width: "100%",
        height: "100%",
      },
      activeSpeakerMode: false,
    },
  });
  const meetingState = useMeetingState();

  // values to unpack from empirica
  const progressLabel = player.get("progressLabel");
  const timestamp = (stageTimer?.elapsed || 0) / 1000;
  const roomUrl = game.get("dailyUrl");

  const displayName = [
    showNickname ? player.get("name") : "",
    showTitle ? player.get("title") : "",
  ]
    .filter((s) => s !== "")
    .join(" - ");

  // reducer for handling (mostly logging) daily events
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
        // callFrame // this is how we would set the input devices, but we can't do this while using the iframe
        //   .setInputDevicesAsync({
        //     videoDeviceId: player.get("cameraId"),
        //     audioDeviceId: player.get("micId"),
        //   })
        //   .then((devices) => {
        //     console.log("Set Input devices: ", devices);
        //   });
        // callFrame.getInputDevices().then((devices) => {
        //   console.log("Input devices: ", devices);
        // });
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

      case "recording-started":
        event.type = "recording-started";
        break;

      case "recording-stopped":
        event.type = "recording-stopped";
        break;

      default:
        throw new Error(
          `VideoCall reducer: unknown action type ${action.type}`
        );
    }

    stage.append("speakerEvents", event);
    console.log("VideoCall event: ", event);
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
    // set user name when we have joined the call
    if (!callFrame || !displayName || meetingState !== "joined-meeting") return;

    try {
      callFrame.setUserName(displayName); // https://docs.daily.co/reference/daily-js/instance-methods/set-user-name
    } catch (err) {
      console.error("Error setting user name: ", err);
      setTimeout(() => {
        try {
          callFrame.setUserName(displayName);
        } catch (err2) {
          console.error("Second error setting user name: ", err2);
        }
      }, 2000); // try again in 2 seconds
    }
  }, [callFrame, displayName, meetingState]);

  useEffect(() => {
    if (!callFrame || !roomUrl) return;
    if (
      ["joining-meeting", "joined-meeting", "left-meeting"].includes(
        meetingState
      )
    )
      return; // we have already joined

    // join the call
    callFrame.join({ url: roomUrl });

    // mount listeners for daily events
    // https://docs.daily.co/reference/daily-js/events/participant-events
    // https://docs.daily.co/reference/daily-js/events/meeting-events

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

    callFrame.on("recording-started", () =>
      dispatch({ type: "recording-started" })
    );

    callFrame.on("recording-stopped", () =>
      dispatch({ type: "recording-stopped" })
    );

    console.log("Mounted listeners");
  }, [callFrame, roomUrl, meetingState]); // room URL should be constant for the whole game

  return (
    <DailyProvider callObject={callFrame}>
      <div ref={callRef} />
    </DailyProvider>
  );
}
