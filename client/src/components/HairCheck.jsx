import { usePlayer } from "@empirica/core/player/classic/react";
import DailyIframe from "@daily-co/daily-js";
import React, { useEffect, useState, useRef } from "react";
import { Video } from "./Video";
import { H3, H4, P } from "./TextStyles";
import { Select } from "./Select";

export function HairCheck({ roomUrl, onAudioSuccess, onVideoSuccess }) {
  const player = usePlayer();

  const fftArray = new Uint8Array(1024);
  const [volume, setVolume] = useState(0);

  const [dailyObject, setDailyObject] = useState(
    DailyIframe.createCallObject()
  );
  const [localStream, setLocalStream] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [microphones, setMicrophones] = useState([]);
  const [analyzerNode, setAnalyzerNode] = useState(null);
  // const [speakers, setSpeakers] = useState([]);
  const [audioSuccess,setAudioSuccess] = useState(false);
  const localStreamRef = useRef();
  localStreamRef.current = localStream;

  const refreshDeviceList = async () => {
    console.log("Requested equipment update");
    const { devices } = await dailyObject.enumerateDevices();
    setCameras(
      devices.filter((d) => d.kind === "videoinput" && d.deviceId !== "")
    );
    setMicrophones(
      devices.filter((d) => d.kind === "audioinput" && d.deviceId !== "")
    );
    // setSpeakers(devices.filter(d => d.kind === 'audiooutput' && d.deviceId !== ''));
  };

  const initializeAnalyzer = () => {
    if (localStreamRef.current instanceof MediaStream) {
      const audioContext = new AudioContext();
      const aNode = audioContext.createAnalyser();
      const audioSourceNode = audioContext.createMediaStreamSource(
        localStreamRef.current
      );
      audioSourceNode.connect(aNode);
      setAnalyzerNode(aNode);
    }
  };

  const mountListeners = () => {
    dailyObject.on("available-devices-updated", refreshDeviceList);

    dailyObject.on("selected-devices-updated", (event) => {
      console.log("New device selection");
      const { camera, mic, speaker } = event.devices;
      if (camera && camera.deviceId !== player.get("camera")) {
        player.set("camera", camera.deviceId);
      } else if (mic && mic.deviceId !== player.get("mic")) {
        player.set("mic", mic.deviceId);
      } else if (speaker && speaker.deviceId !== player.get("speaker")) {
        player.set("speaker", speaker.deviceId);
      }
    });

    dailyObject.on("track-started", (event) => {
      if (event.participant.local) {
        localStreamRef.current.addTrack(event.track);
        initializeAnalyzer();
      }
    });

    dailyObject.on("track-stopped", (event) => {
      if (event.participant.local) {
        localStreamRef.current.removeTrack(event.track);
      }
    });
  };

  useEffect(() => {
    const connect = async () => {
      const { camera, mic, speaker } = await dailyObject.startCamera({
        url: roomUrl,
      });
      const localParticipant = dailyObject.participants().local;
      const videoTrack = localParticipant.tracks.video.persistentTrack;
      const audioTrack = localParticipant.tracks.audio.persistentTrack;
      setLocalStream(new MediaStream([videoTrack, audioTrack]));
      player.set("camera", camera.deviceId);
      player.set("mic", mic.deviceId);
      player.set("speaker", speaker.deviceId);
      await refreshDeviceList();
      mountListeners();
    };

    connect();

    return () => {
      // const tracks = localStream.getTracks();
      // tracks.forEach(track => track.stop());
      dailyObject.destroy();
      setDailyObject(null);
    };
  }, []);

  useEffect(() => {
    if (localStream instanceof MediaStream) {
      initializeAnalyzer();
      onVideoSuccess();
    }
  }, [localStream]);

  useEffect(() => {
    if (analyzerNode) {
      console.log("updated audio Analyzer");

      const updateVolume = setInterval(() => {
        analyzerNode.getByteFrequencyData(fftArray);
        let newVolume = fftArray.reduce((cum, v) => cum + v);
        newVolume /= fftArray.length;
        newVolume = Math.round((newVolume / 256) * 100);
        setVolume(newVolume);
        if (!audioSuccess && newVolume > 5){
          setAudioSuccess(true);
          onAudioSuccess();
        }
      }, 100);
      
      return () => clearInterval(updateVolume);
    }
    return () => {};
  }, [analyzerNode]);
  
  const updateCamera = async (e) => {
    dailyObject.setInputDevicesAsync({
      videoDeviceId: e.target.value,
    });
  };

  const updateMicrophone = async (e) => {
    dailyObject.setInputDevicesAsync({
      audioDeviceId: e.target.value,
    });
  };

  // const updateSpeaker = e => {
  //   dailyObject.setInputDevicesAsync({ audioDeviceId: e.target.value });
  //   player.set('speaker', e.target.value);
  // }

  return (
    <form className="border-1 border-gray-500 p-4 rounded justify-center m-auto flex flex-col">
      <H4>Choose your hardware</H4>

      {localStream ? (
        <Video stream={localStream} muted mirrored />
      ) : (
        <>
          <br />
          <P>Loading video preview...</P>
          <br />
        </>
      )}
      {audioSuccess ? <H3>Mic check succeeded.</H3> : <H3>Please speak into your microphone.</H3>}
      <P>Audio Level Detected: {volume}%</P>

      <div data-test="CameraSelection">
        <P>
          <label htmlFor="cameraOptions">Camera:</label>
        </P>
        <Select
          options={cameras?.map((camera) => ({
            label: camera.label,
            value: camera.deviceId,
          }))}
          onChange={updateCamera}
          testId="cameraSelect"
        />
      </div>

      <div data-test="MicrophoneSelection">
        <P>
          <label htmlFor="micOptions">Microphone:</label>
        </P>
        <Select
          options={microphones?.map((mic) => ({
            label: mic.label,
            value: mic.deviceId,
          }))}
          onChange={updateMicrophone}
          testId="micSelect"
        />
      </div>

      {/* Speakers select TODO: update to use Select component */}
      {/* <div>
        <label htmlFor="speakersOptions">Speakers:</label>
        <select name="speakersOptions" id="speakersSelect" onChange={updateSpeaker}>
        {speakers?.map((speaker) => (
          <option key={`speaker-${speaker.deviceId}`} value={speaker.deviceId}>
            {speaker.label}
          </option>
        ))}
        </select>
      </div> */}
    </form>
  );
}
