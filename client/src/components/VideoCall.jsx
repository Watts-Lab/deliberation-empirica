import { usePlayer, useStage } from "@empirica/core/player/classic/react";
import DailyIframe from "@daily-co/daily-js";
import React, { useEffect, useState, useRef, useReducer } from "react";

export function VideoCall({ roomUrl, record }) {
  const player = usePlayer();
  const stage = useStage();

  // don't call this until roomKey Exists
  const dailyElement = useRef(null);
  const [callFrame, setCallFrame] = useState(null);
  const [userId, setUserId] = useState(null);

  // audio analyzer for when rtcpeerconnection is not available
  const localStreamRef = useRef(new MediaStream());
  const [audioAnalyzer, analyzeAudio] = useReducer((state, action) => {
    switch(action) {
      case "initialize": {
        if (localStreamRef.current.getAudioTracks().length > 0) {
          const audioCtx = new AudioContext();
          const aNode = audioCtx.createAnalyser();
          aNode.fftSize = 256;
          aNode.smoothingTimeConstant = 0;
          const audioSourceNode = audioCtx.createMediaStreamSource(
            localStreamRef.current
          );
          audioSourceNode.connect(aNode);
          console.log(aNode);
          return { audioCtx: aNode, volume: 0 };
        }
        return { audioCtx: null, volume: 0 };
      }
      case "getVolume": {
        const fftArray = new Uint8Array(256);
        audioAnalyzer.audioCtx.getByteFrequencyData(fftArray);
        let newVolume = fftArray.reduce((cum, v) => cum + v);
        newVolume /= fftArray.length;
        newVolume = Math.round((newVolume / 110) * 100);
        console.log(newVolume)
        return { ...state, volume: newVolume }
      }
      default:
        return { ...state };
    }
    
  }, { audioCtx: null, volume: 0 });

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
      if (!window.rtcPeerConnections) {
        navigator.mediaDevices.getUserMedia({audio: true}).then(stream => {
          localStreamRef.current = stream;
          analyzeAudio({ type: "initialize" });
        });
      }
    });

    callFrame.on("track-started", (event) => {
      if (event.participant.local) {
        if (event.track.kind === "video") {
          player.set("videoEnabled", true);
          console.debug("player video started");
        } else if (event.track.kind === "audio") {
          player.set("audioEnabled", true);
          if (!window.rtcPeerConnections) {
            console.log(event.track)
            localStreamRef.current.addTrack(event.track);
            analyzeAudio({ type: "initialize" });
          }
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
          if (!window.rtcPeerConnections) {
            localStreamRef.current.removeTrack(event.track);
          }
          console.debug("player audio stopped");
        }
        console.debug("track-started", event);
      }
    });
  };

  async function getAudioLevel() {
    try {
      if (!window.rtcpeers) {
        if (!audioAnalyzer.audioCtx) {
          console.log(localStreamRef.current.getAudioTracks());
          console.log(audioAnalyzer)
          console.log("Analyzer Node not mounted");
          return;
        }
        console.log(window)
        analyzeAudio({ type: "getVolume" });
        console.log(audioAnalyzer.volume);
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
    const getVolume = setInterval(getAudioLevel, 500);

    return () => clearInterval(getVolume);
  }, [userId, audioAnalyzer.audioCtx]);

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
