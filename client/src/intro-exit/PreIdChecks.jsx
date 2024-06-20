import React, { useEffect, useState } from "react";
import { useGlobal } from "@empirica/core/player/react";
import { CheckboxGroup } from "../components/CheckboxGroup";

export function PreIdChecks({ setChecksPassed }) {
  const globals = useGlobal();
  const batchConfig = globals?.get("recruitingBatchConfig");
  const checkVideo = batchConfig?.checkVideo ?? true; // default to true if not specified (or if globals not loaded)
  const checkAudio = (batchConfig?.checkAudio ?? true) || checkVideo; // default to true if not specified, force true if checkVideo is true
  const [checks, setChecks] = useState([]);

  useEffect(() => {
    if (!checkVideo && !checkAudio) {
      setChecksPassed(true);
    }
  }, [checkVideo, checkAudio]);

  const handleChange = (selected) => {
    setChecks(selected);

    const checksPass =
      ((!checkVideo || selected.includes("webcam")) &&
        (!checkAudio ||
          (selected.includes("mic") && selected.includes("headphones")))) ??
      false;

    setChecksPassed(checksPass);
  };

  const options = [];
  if (checkVideo) {
    options.push({ key: "webcam", value: "I have a working webcam" });
  }
  if (checkAudio) {
    options.push({ key: "mic", value: "I have a working microphone" });
    options.push({
      key: "headphones",
      value: "I have working headphones or earbuds",
    });
  }

  return (
    <div>
      <h3>Please confirm the following to participate:</h3>

      <CheckboxGroup
        options={options}
        selected={checks}
        onChange={handleChange}
        testId="checks"
      />
    </div>
  );
}
