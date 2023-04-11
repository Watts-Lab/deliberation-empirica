import React from "react";
import { Button } from "../components/Button";

export function SubmitButton({ onSubmit, buttonText }) {
  return (
    <div className="mt-4">
      <Button testId="submitButton" handleClick={onSubmit}>
        <p>{buttonText}</p>
      </Button>
    </div>
  );
}
