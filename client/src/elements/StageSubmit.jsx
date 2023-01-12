import React from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Button } from "../components/Button";

export function StageSubmit() {
  const player = usePlayer();
  return (
    <div className="mt-4">
      <Button
        testId="submitButton"
        handleClick={() => player.stage.set("submit", true)}
      >
        Next
      </Button>
    </div>
  );
}
