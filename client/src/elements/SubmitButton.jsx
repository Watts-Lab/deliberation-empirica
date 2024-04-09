import React, { useState, useEffect } from "react";
import { usePlayer, useStageTimer } from "@empirica/core/player/classic/react";
import { Button } from "../components/Button";

// buttonText changes based on what the treatment yaml file specifies
// if no buttonText is specified, the default is "Next"
// onSubmit is a function that is called when the button is clicked
// name is a string that is used to identify the submit button to be used in later conditions

export function SubmitButton({ onSubmit, name, buttonText = "Next" }) {
  const player = usePlayer();
  const stageTimer = useStageTimer();
  const [loadedTime, setLoadedTime] = useState(-1);

  useEffect(() => {
    setLoadedTime(Date.now());
  }, []);

  const submit = () => {
    if (name) {
      const elapsed = stageTimer
        ? stageTimer.elapsed / 1000
        : (Date.now() - loadedTime) / 1000;
      player.set(`submitButton_${name}`, { time: elapsed });
    }
    onSubmit();
  };

  return (
    <div className="mt-4">
      <Button testId="submitButton" handleClick={submit}>
        {buttonText}
      </Button>
    </div>
  );
}
