import React from "react";
import { Button } from "../components/Button";

const refreshPage = () => {
  console.log(
    "make sure to allow access to your microphone and camera in your browser's permissions"
  );
  window.location.reload();
};

export function UserMediaError() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-950/30 p-6">
      <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border border-red-500/50 bg-slate-900/70 p-8 text-center text-slate-100 shadow-2xl">
        <h1 className="text-2xl font-semibold text-red-200">
          Camera or mic blocked
        </h1>
        <p className="text-sm text-slate-200">
          Please allow access to your camera and microphone, then try again.
        </p>
        <Button
          handleClick={refreshPage}
          testId="retryUserMedia"
          className="px-6"
        >
          Try again
        </Button>
        <p className="text-sm">
          <a
            href="https://docs.daily.co/guides/how-daily-works/handling-device-permissions"
            target="_blank"
            rel="noreferrer"
            className="text-red-200 underline"
          >
            Get help
          </a>
        </p>
      </div>
    </div>
  );
}
