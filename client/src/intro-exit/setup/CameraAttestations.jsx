import React, { useState, useEffect } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { CheckboxGroup } from "../../components/CheckboxGroup";

const attestations = [
  {
    key: "seeSelf",
    value: "You can see your head and shoulders in the display above",
  },
  {
    key: "stable",
    value: "Your computer is sitting on a desk or table, not your lap",
  },
  {
    key: "background",
    value: "Your background reveals nothing private",
  },
  {
    key: "noOthers",
    value: "No other people will be seen on camera during the study",
  },
];

export function CameraAttestations({
  cameraAttestations,
  setCameraAttestations,
}) {
  const player = usePlayer();
  const [optionsChecked, setOptionsChecked] = useState([]);

  useEffect(() => {
    if (
      optionsChecked.length === attestations.length &&
      cameraAttestations !== "complete"
    ) {
      const logEntry = {
        step: "cameraAttestations",
        event: "attestationsChecked",
        value: optionsChecked,
        errors: [],
        debug: {},
        timestamp: new Date().toISOString(),
      };

      player.append("setupSteps", logEntry);
      console.log("Camera attestations checked", logEntry);
      setCameraAttestations("complete");
    }
  }, [optionsChecked, setCameraAttestations, player, cameraAttestations]);

  return (
    <div>
      <h2>👉 Please confirm that:</h2>

      <CheckboxGroup
        options={attestations}
        selected={optionsChecked}
        onChange={setOptionsChecked}
        testId="setupChecklist"
      />

      <br />
      <p className="text-gray-500 text-sm">
        These conditions are to protect your privacy and the privacy of others
        in your physical space.
      </p>
    </div>
  );
}
