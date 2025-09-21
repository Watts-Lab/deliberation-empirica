import React, { useState, useEffect } from "react";
import { useGlobal } from "@empirica/core/player/react";
import { DailyProvider } from "@daily-co/daily-react";

import { usePlayer } from "@empirica/core/player/classic/react";
import { Button } from "../../components/Button";

import { GetPermissions } from "./GetPermissions";
import { CameraCheck } from "./CameraCheck";
import { MicCheck } from "./MicCheck";
import { HeadphonesCheck } from "./HeadphonesCheck";
import { LoopbackCheck } from "./LoopbackCheck";

const roomUrl = "https://deliberation.daily.co/HairCheckRoom";

export function EquipmentCheck({ next }) {
  const globals = useGlobal();
  const player = usePlayer();
  const batchConfig = globals?.get("recruitingBatchConfig");
  const checkVideo = batchConfig?.checkVideo ?? true; // default to true if not specified
  const checkAudio = (batchConfig?.checkAudio ?? true) || checkVideo; // default to true if not specified, force true if checkVideo is true

  const [allChecksStatus, setAllChecksStatus] = useState("waiting"); // "waiting", "started", "pass", "fail"
  const [permissionsStatus, setPermissionsStatus] = useState("waiting"); // "waiting", "pass", "fail"
  const [webcamStatus, setWebcamStatus] = useState("waiting"); // "waiting", "pass", "fail"
  const [micStatus, setMicStatus] = useState("waiting"); // "waiting", "started", "pass", "fail"
  const [headphonesStatus, setHeadphonesStatus] = useState("waiting"); // "waiting", "pass", "fail"
  const [loopbackStatus, setLoopbackStatus] = useState("waiting"); // "waiting", "pass", "fail"

  useEffect(() => {
    console.log("Intro: Equipment Check");
    if (allChecksStatus === "started" && window.Cypress) {
      setAllChecksStatus("pass"); // Auto-pass in Cypress tests
    }
  }, [allChecksStatus]);

  useEffect(() => {
    if (
      permissionsStatus === "pass" &&
      webcamStatus === "pass" &&
      micStatus === "pass" &&
      headphonesStatus === "pass" &&
      (loopbackStatus === "pass" || loopbackStatus === "override")
    ) {
      setAllChecksStatus("pass");
    } else if (
      permissionsStatus === "fail" ||
      webcamStatus === "fail" ||
      micStatus === "fail" ||
      headphonesStatus === "fail" ||
      loopbackStatus === "fail"
    ) {
      setAllChecksStatus("fail");
    }
  }, [
    headphonesStatus,
    loopbackStatus,
    micStatus,
    permissionsStatus,
    webcamStatus,
  ]);

  useEffect(() => {
    if (allChecksStatus === "started") {
      if (!checkVideo) {
        setWebcamStatus("pass");
      }
      if (!checkAudio) {
        setMicStatus("pass");
        setLoopbackStatus("pass");
      }
      if (!checkAudio && !checkVideo) {
        setPermissionsStatus("pass");
      }
    }
  }, [
    allChecksStatus,
    checkVideo,
    checkAudio,
    setWebcamStatus,
    setMicStatus,
    setPermissionsStatus,
    setLoopbackStatus,
  ]);

  useEffect(() => {
    // Log the equipment check status when all checks are complete
    if (allChecksStatus === "pass") {
      const logEntry = {
        step: "equipmentCheck",
        event: "pass",
        errors: [],
        debug: {},
        timestamp: new Date().toISOString(),
      };
      player.append("setupSteps", logEntry);
      next(); // Proceed to the next step after all checks are successful
    }
  }, [player, next, allChecksStatus]);

  const handleRestart = () => {
    const logEntry = {
      step: "soundCheck",
      event: "restart",
      errors: [],
      debug: {
        permissionsStatus,
        webcamStatus,
        micStatus,
        headphonesStatus,
        loopbackStatus,
      },
      timestamp: new Date().toISOString(),
    };

    player.append("setupSteps", logEntry);
    console.log("Equipment check restarted", logEntry);
    window.location.reload(); // Reload the page to restart the entire equipment check process
  };

  // DailyProvider creates its own callObject instance, that we can access in child components
  return (
    <DailyProvider url={roomUrl}>
      <div className="grid justify-center">
        <div className="max-w-xl">
          {allChecksStatus === "waiting" && (
            <div className="mt-20">
              <div className="flex flex-col justify-center items-center">
                <h2>
                  {checkVideo && checkAudio && " Set up Camera and Sound"}
                  {checkVideo && !checkAudio && " Set up Camera"}
                  {!checkVideo && checkAudio && " Set up Sound"}
                </h2>
                <h3>👇 You will need 👇</h3>
                <ul className="list-disc">
                  {checkVideo && <li>Webcam</li>}
                  {checkAudio && <li>Microphone</li>}
                  <li>Headphones (not speakers)</li>
                </ul>
                <br />
                <Button handleClick={() => setAllChecksStatus("started")}>
                  Begin Equipment Setup
                </Button>
              </div>
            </div>
          )}

          {allChecksStatus === "started" && permissionsStatus !== "pass" && (
            <GetPermissions setPermissionsStatus={setPermissionsStatus} />
          )}

          {permissionsStatus === "pass" && webcamStatus !== "pass" && (
            <CameraCheck setWebcamStatus={setWebcamStatus} />
          )}

          {webcamStatus === "pass" && headphonesStatus !== "pass" && (
            <HeadphonesCheck setHeadphonesStatus={setHeadphonesStatus} />
          )}

          {headphonesStatus === "pass" && micStatus !== "pass" && (
            <MicCheck setMicStatus={setMicStatus} />
          )}

          {micStatus === "pass" && loopbackStatus !== "pass" && (
            <LoopbackCheck
              loopbackStatus={loopbackStatus}
              setLoopbackStatus={setLoopbackStatus}
            />
          )}

          {allChecksStatus === "fail" && (
            <div className="mt-10 text-center">
              <h2 className="text-2xl font-bold mb-4 text-red-600">
                Some equipment checks failed.
              </h2>
              <Button handleClick={handleRestart}>
                Restart Equipment Check
              </Button>
            </div>
          )}
        </div>
      </div>
    </DailyProvider>
  );
}
