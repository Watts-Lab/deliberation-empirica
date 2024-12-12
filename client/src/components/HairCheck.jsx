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
  onFailure = () => {},
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
        onFailure={onFailure}
      />
    </DailyProvider>
  );
}

function InnerHairCheck({
  hideAudio,
  hideVideo,
  onVideoSuccess,
  onAudioSuccess,
  onFailure,
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
  const deviceRefreshTimeoutRef = useRef(null);

  useEffect(() => {
    let callQualityTestTimer;
    const startHairCheck = async () => {
      try {
        console.log("Starting hair-check camera");
        await callObject.startCamera();
        const hairCheckResults = {};

        // Check that we can establish a connection to daily.co turn server (
        // see: https://docs.daily.co/reference/daily-js/instance-methods/test-network-connectivity
        const videoTrack =
          callObject.participants()?.local?.tracks?.video.persistentTrack;
        const networkTestResult = await callObject.testNetworkConnectivity(
          videoTrack
        );
        console.log("Network test result: ", networkTestResult);
        hairCheckResults.networkTestResult = networkTestResult.result;

        // Check that user is allowed to use websockets (they shouldn't be able to use DL if this is false, but good to know)
        // see: https://docs.daily.co/reference/daily-js/instance-methods/test-websocket-connectivity
        const websocketTestResult =
          await callObject.testWebsocketConnectivity();
        console.log("Websocket test result: ", websocketTestResult);
        hairCheckResults.websocketTestResult = websocketTestResult.result;

        // Test call quality
        // see: https://docs.daily.co/reference/daily-js/instance-methods/test-call-quality
        callQualityTestTimer = setTimeout(() => {
          console.log("Stopping call quality test");
          callObject.stopTestCallQuality();
        }, 10000); // stop the test after 10 seconds
        const callQualityTestResult = await callObject.testCallQuality();
        console.log("Call quality test result: ", callQualityTestResult);
        hairCheckResults.callQualityTestResult = callQualityTestResult; // include detailed results

        player.set("hairCheckResults", hairCheckResults);

        if (
          networkTestResult.result !== "passed" ||
          websocketTestResult.result !== "passed" ||
          !["good", "warning"].includes(callQualityTestResult.result) // "good" or "warning" are acceptable
        ) {
          console.log("Hair-check failed: ", hairCheckResults);
          onFailure();
        }

        onVideoSuccess(true);
        startedRef.current = true;
      } catch (err) {
        console.error("Error in hair-check: ", err);
        onFailure();
      }
    };

    if (callObject && !startedRef.current) startHairCheck();

    return () => {
      console.log("Stopping hair-check camera");
      callObject?.destroy();
      clearTimeout(callQualityTestTimer);
    };
  }, [callObject]); // intentionally leaving out onVideoSuccess and onFailure because we don't want to trigger the cleanup too soon.

  useEffect(() => {
    if (devices.microphones.length === 0 && !deviceRefreshTimeoutRef.current) {
      deviceRefreshTimeoutRef.current = setTimeout(() => {
        console.log("Refreshing devices...");
        deviceRefreshTimeoutRef.current = null; // Clear the ref after timeout
        devices.refreshDevices();
      }, 200);
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
  }, [devices, player, callObject]);

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
