import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  DailyProvider,
  useDevices,
  useLocalSessionId,
  DailyVideo,
  useAudioLevelObserver,
  useDaily,
} from "@daily-co/daily-react";

import { usePlayer } from "@empirica/core/player/classic/react";
import { Select } from "./Select";

const VOLUME_SUCCESS_THRESHOLD = 20;

export function HairCheck({
  roomUrl,
  onAudioSuccess = () => {},
  onVideoSuccess = () => {},
  hideAudio = false,
  hideVideo = false,
}) {
  return (
    <DailyProvider url={roomUrl}>
      <InnerHairCheck
        hideAudio={hideAudio}
        hideVideo={hideVideo}
        onAudioSuccess={onAudioSuccess}
        onVideoSuccess={onVideoSuccess}
      />
    </DailyProvider>
  );
}

function InnerHairCheck({
  hideAudio,
  hideVideo,
  onVideoSuccess,
  onAudioSuccess,
}) {
  const player = usePlayer();
  const devices = useDevices();
  const localSessionId = useLocalSessionId();
  const callObject = useDaily();
  const [volume, setVolume] = useState(0);
  const startedRef = useRef(false);
  const audioSuccessRef = useRef(false);
  const currentMicIdRef = useRef(null);
  const currentCameraIdRef = useRef(null);

  useEffect(() => {
    const startHairCheck = async () => {
      console.log("Starting hair-check camera");
      await callObject.startCamera();
      onVideoSuccess(true);
      startedRef.current = true;
    };

    if (callObject && !startedRef.current) startHairCheck();

    return () => {
      console.log("Stopping hair-check camera");
      callObject?.destroy();
    };
  }, [callObject, onVideoSuccess]);

  useEffect(() => {
    if (devices.microphones.length === 0) {
      console.log("Refreshing devices...");
      devices.refreshDevices();
    }

    const micId = devices?.currentMic?.device?.deviceId;
    const camId = devices?.currentCam?.device?.deviceId;
    if (micId && currentMicIdRef.current !== micId) {
      currentMicIdRef.current = micId;
      player.set("micId", micId);
      console.log("Setting micId: ", micId);
      callObject.getInputDevices().then((d) => {
        console.log("Devices from callObject: ", d);
      });
    }
    if (camId && currentCameraIdRef.current !== camId) {
      currentCameraIdRef.current = camId;
      player.set("cameraId", camId);
      console.log("Setting cameraId: ", camId);
    }
  }, [devices]);

  useAudioLevelObserver(
    // see: https://docs.daily.co/reference/daily-react/use-audio-level-observer
    localSessionId,
    useCallback(
      (rawVolume) => {
        // this volume number will be between 0 and 1
        setVolume(rawVolume * 100);
        if (
          !audioSuccessRef.current &&
          rawVolume * 100 > VOLUME_SUCCESS_THRESHOLD
        ) {
          audioSuccessRef.current = true;
          onAudioSuccess(true);
        }
      },
      [onAudioSuccess]
    )
  );

  return (
    <form className="p-4 rounded justify-center m-auto flex flex-col">
      <div className={`${hideVideo ? "h-0" : ""}`}>
        {!hideVideo && <DailyVideo sessionId={localSessionId} mirror />}

        {!hideVideo && devices?.cameras?.length > 1 && (
          // only offer to select webcam if there is more than one option
          <div data-test="CameraSelection">
            <p>
              <label htmlFor="cameraOptions">
                Please select which webcam you wish to use:
              </label>
            </p>
            <Select
              options={devices?.cameras?.map((camera) => ({
                label: camera.device.label,
                value: camera.device.deviceId,
              }))}
              onChange={(e) => devices.setCamera(e.target.value)}
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
          {devices?.microphones?.length > 1 && (
            <div data-test="MicrophoneSelection">
              <p>
                <label htmlFor="micOptions">
                  Please select the microphone you wish to use:
                </label>
              </p>
              <Select
                options={devices?.microphones?.map((mic) => ({
                  label: mic.device.label,
                  value: mic.device.deviceId,
                }))}
                onChange={(e) => devices.setMicrophone(e.target.value)}
                testId="micSelect"
              />
            </div>
          )}
        </div>
      )}
    </form>
  );
}
