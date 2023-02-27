import React from "react";
import { Button } from "../components/Button";

export function SubmitButton({ onSubmit }) {
  return (
    <div className="mt-4">
      <Button testId="submitButton" handleClick={onSubmit}>
        Next
      </Button>
    </div>
  );
}