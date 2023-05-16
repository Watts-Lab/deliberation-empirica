import React from "react";
import { Button } from "../components/Button";

// buttonText changes based on what the treatment yaml file specifies
export function SubmitButton({ onSubmit, buttonText = "Next" }) {
  return (
    <div className="mt-4">
      <Button testId="submitButton" handleClick={onSubmit}>
        {buttonText}
      </Button>
    </div>
  );
}
