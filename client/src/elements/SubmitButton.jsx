import React from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Button } from "../components/Button";
import {
  useProgressLabel,
  useStepElapsedGetter,
} from "../components/ProgressLabelContext";

// buttonText changes based on what the treatment yaml file specifies
// if no buttonText is specified, the default is "Next"
// onSubmit is a function that is called when the button is clicked
// name is a string that is used to identify the submit button to be used in later conditions

export function SubmitButton({ onSubmit, name, buttonText = "Next" }) {
  const player = usePlayer();
  const getElapsedSeconds = useStepElapsedGetter();
  const progressLabel = useProgressLabel();
  const buttonName = name || progressLabel;

  const submit = () => {
    const elapsed = getElapsedSeconds();
    player.set(`submitButton_${buttonName}`, { time: elapsed });

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
