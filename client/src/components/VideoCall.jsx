import { usePlayer, useStage } from "@empirica/core/player/classic/react";
import DailyIframe from "@daily-co/daily-js";
import React, { useEffect, useState, useRef } from "react";

export function VideoCall({ roomUrl, record }) {
  const player = usePlayer();
  const stage = useStage();

  // don't call this until roomKey Exists
  const dailyElement = useRef(null);
  const [callFrame, setCallFrame] = useState(null);
  const [userId, setUserId] = useState(null);

  const mountListeners = () => {
    callFrame.on("joined-meeting", (event) => {
      console.debug("Joined Meeting", event);
      const dailyIds = player.get("dailyIds");
      const newIds = {};
      newIds[stage.id] = event.participants.local.user_id;
      setUserId(event.participants.local.user_id);
      if (!dailyIds) {
        player.set("dailyIds", newIds);
      } else {
        player.set("dailyIds", { ...newIds, ...dailyIds });
      }
      if (record && !stage.get("recorded")) {
        callFrame.startRecording();
        stage.set("recorded", true);
      }
    });

    callFrame.on("track-started", (event) => {
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

  async function getAudioLevel() {
    try {
      if (!window.rtcpeers) {
        console.log(window)
        const senders = new window.RTCPeerConnection().getSenders().find(s => s.track.type === 'audio');
        console.log(Array.from((await senders.getStats()).values()).find(s => 'audioLevel' in s).audioLevel);
        return;
      }
      // SFU Audio level
      if (window.rtcpeers.getCurrentType() === "sfu") {
        console.log("sfu mode")
        // eslint-disable-next-line no-underscore-dangle
        const consumer = window.rtcpeers.sfu.producers.find((p) => p._kind === "audio");
        if (!(consumer && consumer.getStats)) {
          return;
        }
        console.log(Array.from((await consumer.getStats()).values()).find(
          (s) => 'audioLevel' in s
        ).audioLevel);
      }
      // P2P Audio level
      const consumer = window.rtcpeers.peerToPeer.rtcPeerConnections[userId];
      if (!(consumer && consumer.getStats)) {
        return;
      }
      console.log(Array.from((await consumer.getStats()).values()).find(
        (s) => 'type' in s && s.type === 'inbound-rtp'  && 'audioLevel' in s
      ).audioLevel);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    console.log("mounted audio analyzer")
    const getVolume = setInterval(getAudioLevel, 10000);

    return () => clearInterval(getVolume);
  }, [userId]);

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
