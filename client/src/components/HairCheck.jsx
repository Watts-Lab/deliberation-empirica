import { usePlayer } from "@empirica/core/player/classic/react";
import DailyIframe from "@daily-co/daily-js";
import React, { useEffect, useState, useRef } from "react";
import { Video } from "./Video";
import { Select } from "./Select";

const VOLUME_SUCCESS_THRESHOLD = 5;

export function HairCheck({
  roomUrl,
  onAudioSuccess = () => {},
  onVideoSuccess = () => {},
  hideVideo = false,
  hideAudio = false,
}) {
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
  const [audioSuccess, setAudioSuccess] = useState(false);
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
      try {
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
      } catch (e) {
        alert(
          "Looks like there's an issue connecting to your camera or microphone. If you are using windows, you may need to make sure that no other program (e.g. Zoom) is using your camera or microphone already. Once you've checked this, try refreshing the page."
        );
        console.error("Error connecting to Daily", e);
      }
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
    if (cameras.length > 0 && localStream instanceof MediaStream) {
      console.log(`Found ${cameras.length} webcam(s)`);
      initializeAnalyzer();
      onVideoSuccess(true);
    }
  }, [localStream, cameras]);

  useEffect(() => {
    if (analyzerNode) {
      console.log("updated audio Analyzer");

      const updateVolume = setInterval(() => {
        analyzerNode.getByteFrequencyData(fftArray);
        let newVolume = fftArray.reduce((cum, v) => cum + v);
        newVolume /= fftArray.length;
        newVolume = Math.round((newVolume / 256) * 100);
        setVolume(newVolume);
        if (!audioSuccess && newVolume > VOLUME_SUCCESS_THRESHOLD) {
          setAudioSuccess(true);
          onAudioSuccess(true);
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

  return (
    <form className="p-4 rounded justify-center m-auto flex flex-col">
      <div className={`${hideVideo ? "h-0" : ""}`}>
        {localStream ? (
          <Video stream={localStream} muted mirrored />
        ) : (
          <p>Loading video preview...</p>
        )}
        {!hideVideo && cameras.length > 1 && (
          // only offer to select webcam if there is more than one option
          <div data-test="CameraSelection">
            <p>
              <label htmlFor="cameraOptions">
                Please select which webcam you wish to use:
              </label>
            </p>
            <Select
              options={cameras?.map((camera) => ({
                label: camera.label,
                value: camera.deviceId,
              }))}
              onChange={updateCamera}
              testId="cameraSelect"
            />
          </div>
        )}
      </div>

      {!hideAudio && (
        <div>
          Audio level:
          <div className="bg-gray-200 border-1 w-full flex">
            <div
              data-test="audioLevelIndicator"
              className="bg-blue-600"
              style={{ height: "24px", width: `${volume}%` }}
            />
          </div>
          {microphones.length > 1 && (
            <div data-test="MicrophoneSelection">
              <p>
                <label htmlFor="micOptions">
                  Please select the microphone you wish to use:
                </label>
              </p>
              <Select
                options={microphones?.map((mic) => ({
                  label: mic.label,
                  value: mic.deviceId,
                }))}
                onChange={updateMicrophone}
                testId="micSelect"
              />
            </div>
          )}
        </div>
      )}
    </form>
  );
}
