import React, { useState, useEffect } from "react";
import { useGlobal } from "@empirica/core/player/react";
import { DailyProvider } from "@daily-co/daily-react";

import { usePlayer } from "@empirica/core/player/classic/react";
import { CameraCheck } from "./CameraCheck";
import { SoundCheck } from "./SoundCheck";
import { Button } from "../../components/Button";
import { GetPermissions } from "./GetPermissions";
import { FailureCode } from "./FailureCode";

const roomUrl = "https://deliberation.daily.co/HairCheckRoom";

export function EquipmentCheck({ next }) {
  const globals = useGlobal();
  const player = usePlayer();
  const batchConfig = globals?.get("recruitingBatchConfig");
  const checkVideo = batchConfig?.checkVideo ?? true; // default to true if not specified
  const checkAudio = (batchConfig?.checkAudio ?? true) || checkVideo; // default to true if not specified, force true if checkVideo is true

  const [checksStatus, setChecksStatus] = useState(
    window.Cypress ? "started" : "waiting"
  ); // In cypress tests, skip to the end.
  const [permissionsStatus, setPermissionsStatus] = useState(
    window.Cypress ? "complete" : "waiting"
  ); // In cypress tests, skip to the end.
  const [webcamStatus, setWebcamStatus] = useState(
    !checkVideo || window.Cypress ? "complete" : "waiting"
  ); // In cypress tests, skip to the end.
  const [soundStatus, setSoundStatus] = useState(
    !checkAudio || window.Cypress ? "complete" : "waiting"
  ); // In cypress tests, skip to the end.

  useEffect(() => {
    console.log("Intro: Equipment Check");
  }, []); // intentionally empty dependency array to run only once when component mounts

  useEffect(() => {
    // Log the equipment check status when all checks are complete
    if (
      permissionsStatus === "complete" &&
      webcamStatus === "complete" &&
      soundStatus === "complete"
    ) {
      const logEntry = {
        step: "equipmentCheck",
        event: "complete",
        errors: [],
        debug: {},
        timestamp: new Date().toISOString(),
      };
      player.append("setupSteps", logEntry);
      console.log("Equipment check started", logEntry);
      next(); // Proceed to the next step after all checks are successful
    }
  }, [player, permissionsStatus, webcamStatus, soundStatus, next]);

  // DailyProvider creates its own callObject instance, that we can access in child components
  return (
    <DailyProvider url={roomUrl}>
      <FailureCode />

      <div className="grid justify-center">
        <div className="max-w-xl">
          {checksStatus === "waiting" && (
            <div className="mt-20">
              <div className="flex flex-col justify-center items-center">
                <h2> Set up Camera and Sound</h2>
                <h3>👇 You will need 👇</h3>
                <ul className="list-disc">
                  <li>Webcam</li>
                  <li>Microphone</li>
                  <li>Headphones (not speakers)</li>
                </ul>
                <br />
                <Button handleClick={() => setChecksStatus("started")}>
                  Begin Equipment Setup
                </Button>
              </div>
            </div>
          )}

          {checksStatus === "started" && permissionsStatus === "waiting" && (
            <GetPermissions setPermissionsStatus={setPermissionsStatus} />
          )}

          {permissionsStatus === "complete" && webcamStatus === "waiting" && (
            <CameraCheck setWebcamStatus={setWebcamStatus} />
          )}

          {webcamStatus === "complete" && soundStatus === "waiting" && (
            <SoundCheck setSoundStatus={setSoundStatus} />
          )}
        </div>
      </div>
    </DailyProvider>
  );
}
