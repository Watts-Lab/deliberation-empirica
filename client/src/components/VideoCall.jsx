import {
  usePlayer,
  useStage,
  useGame,
  useStageTimer,
} from "@empirica/core/player/classic/react";
import DailyIframe from "@daily-co/daily-js";
import React, { useEffect, useState, useRef } from "react";
import { useProgressLabel } from "./utils";
import { H3 } from "./TextStyles";

// TODO: do we need the 'record' parameter?

export function VideoCall({ showNickname, showTitle }) {
  const stageTimer = useStageTimer();
  const player = usePlayer();
  const stage = useStage();
  const game = useGame();
  const progressLabel = useProgressLabel();
  const dailyElement = useRef(null);
  const timestamp = useRef((stageTimer?.elapsed || 0) / 1000); // this is to avoid the closure problem in useEffect
  const videoOn = useRef(true); // this is to avoid the closure problem in useEffect
  const audioOn = useRef(true);
  const [callFrame, setCallFrame] = useState(null);

  const roomUrl = game.get("dailyUrl");

  timestamp.current = (stageTimer?.elapsed || 0) / 1000;

  const handleStartedSpeaking = () => {
    stage.append("speakerEvents", {
      participant: player.id,
      type: "started-speaking",
      stage: progressLabel,
      timestamp,
      method: "active-speaker-change",
    });

    player.set("startedSpeakingAt", timestamp.current);
    console.log("Started speaking at ", timestamp.current);
  };

  const handleStoppedSpeaking = () => {
    stage.append("speakerEvents", {
      participant: player.id,
      type: "stopped-speaking",
      stage: progressLabel,
      timestamp: timestamp.current,
      method: "active-speaker-change",
    });

    // compute cumulative speaking time
    const prevCumulative = player.get("cumulativeSpeakingTime") || 0;
    const speakingTime = timestamp.current - player.get("startedSpeakingAt");
    player.set("cumulativeSpeakingTime", prevCumulative + speakingTime);

    // reset the player's startedSpeakingAt time, as they are no longer speaking
    player.set("startedSpeakingAt", null);
    console.log("Stopped speaking at ", timestamp.current);
  };

  const handleJoinedMeeting = (event) => {
    player.append("dailyIds", event.participants.local.user_id); // each time we join, we get a new daily ID
    stage.set("callStarted", true); // just in case we are the first to join, trigger server-side action to start recording
    stage.append("speakerEvents", {
      participant: player.id,
      type: "joined-meeting",
      stage: progressLabel,
      timestamp: timestamp.current,
      method: "joined-meeting-callback",
    });
    console.log("Joined meeting at ", timestamp.current);
  };

  const handleLeftMeeting = (event) => {
    stage.append("speakerEvents", {
      participant: player.id,
      type: "left-meeting",
      stage: progressLabel,
      timestamp: timestamp.current,
      method: "left-meeting-callback",
    });
    if (player.get("startedSpeakingAt")) {
      handleStoppedSpeaking();
    }
    console.log("Left meeting at ", timestamp.current);
  };

  const handleTrackChange = (event) => {
    const { type, action } = event; // track {"video" or "audio"}, action {"track-started" or "track-stopped"}

    stage.append("speakerEvents", {
      participant: player.id,
      type: `${type}-${action}`,
      stage: progressLabel,
      timestamp: timestamp.current,
      method: "track-change-callback",
    });
    console.log(
      `Changed mute settings ${type} ${action} at `,
      timestamp.current
    );
  };

  const handleVideoMuteChange = (newVideoState) => {
    videoOn.current = newVideoState;
    stage.append("speakerEvents", {
      participant: player.id,
      type: `video-${newVideoState ? "started" : "stopped"}`,
      stage: progressLabel,
      timestamp: timestamp.current,
      method: "participant-updated-callback",
    });
    console.log(
      `Video ${newVideoState ? "started" : "stopped"} at `,
      timestamp.current
    );
  };

  const handleAudioMuteChange = (newAudioState) => {
    audioOn.current = newAudioState;
    stage.append("speakerEvents", {
      participant: player.id,
      type: `audio-${newAudioState ? "started" : "stopped"}`,
      stage: progressLabel,
      timestamp: timestamp.current,
      method: "participant-updated-callback",
    });
    console.log(
      `Audio ${newAudioState ? "started" : "stopped"} at `,
      timestamp.current
    );
  };

  const mountListeners = () => {
    // Meeting events
    callFrame.on("joined-meeting", handleJoinedMeeting);
    callFrame.on("left-meeting", handleLeftMeeting);
    callFrame.on("active-speaker-change", (event) => {
      if (
        event.activeSpeaker.peerId === callFrame.participants().local.session_id
      ) {
        handleStartedSpeaking();
      } else if (player.get("startedSpeakingAt")) {
        handleStoppedSpeaking();
      }
      // otherwise, the speaker switched between two other players
    });

    // Participant events
    callFrame.on("track-started", handleTrackChange);
    callFrame.on("track-stopped", handleTrackChange);

    callFrame.on("participant-updated", (event) => {
      if (event.participant.video !== videoOn.current) {
        handleVideoMuteChange(event.participant.video);
      }
      if (event.participant.audio !== audioOn.current) {
        handleAudioMuteChange(event.participant.audio);
      }
    });

    console.log("Mounted listeners at", timestamp.current); // This time gets set as stageElapsed when the handler fires...
  };

  useEffect(() => {
    if (dailyElement.current && !callFrame) {
      // when component starts, only once
      const name = player.get("name") || player.id;
      const title = player.get("title") || "";

      let displayName = "";
      if (showNickname && showTitle) {
        displayName = `${name} (${title})`;
      } else if (showNickname) {
        displayName = name;
      } else if (showTitle) {
        displayName = title;
      } else {
        displayName = player.get("position");
      }

      setCallFrame(
        DailyIframe.wrap(dailyElement.current, {
          activeSpeakerMode: false,
          userName: displayName,
          videoSource: player.get("camera"),
          audioSource: player.get("mic"),
        })
      );
      console.log("Created callFrame at", timestamp.current);
    }
  }, [dailyElement]);

  useEffect(() => {
    if (callFrame) {
      mountListeners();
      callFrame.join({ url: roomUrl });
    }

    return () => {
      handleLeftMeeting();
      if (callFrame) callFrame.leave();
    };
  }, [callFrame]);

  if (!player || !game || !stageTimer || !roomUrl)
    return (
      <H3> Loading meeting room. This should take ~30 seconds or less. </H3>
    );

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
