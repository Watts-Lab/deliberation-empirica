// import { isDevelopment } from "@empirica/core/player";
import { usePlayer } from "@empirica/core/player/classic/react";
import React, { useEffect, useState } from "react";
import { HairCheck } from "../components/HairCheck";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { CheckboxGroup } from "../components/CheckboxGroup";
import { H1, H3, P } from "../components/TextStyles";

export function VideoCheck({ next }) {
  const player = usePlayer();

  const isDevelopment = ["dev", "test"].includes(
    player.get("deployEnvironment")
  );

  const dailyUrl = "https://deliberation.daily.co/HairCheckRoom";

  const [setupChecked, setSetupChecked] = useState([]);
  const [incorrectResponse, setIncorrectResponse] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(!isDevelopment);

  // eslint-disable-next-line consistent-return -- not a mistake
  useEffect(() => {
    console.log("Intro: Video Check");
  }, []);

  function handleSubmit(event) {
    event.preventDefault();

    if (setupChecked.length === 4) {
      console.log("Videocheck complete");
      next();
    } else {
      console.log("Videocheck submitted with errors");
      setIncorrectResponse(true);
    }

    if (incorrectResponse) {
      document.getElementById("alert").scrollIntoView(true);
    }
  }

  const renderQuiz = () => (
    <div>
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div>
          <H3>Please confirm all of the following to continue.</H3>
          {incorrectResponse && (
            <div id="alert" className="my-5">
              <Alert
                title="Not all of the necessary items were confirmed!"
                kind="error"
              >
                Please confirm all of the following to continue.
              </Alert>
            </div>
          )}

          <div className="ml-2 mt-2 space-y-1">
            <CheckboxGroup
              options={{
                private: "I am in a private space.",
                noInterrupt:
                  "I will not be interrupted for the next 15-30 minutes.",
                see: "I can see my head and shoulders in the video window.",
                background:
                  "My background doesn't reveal personal information about me.",
              }}
              selected={setupChecked}
              onChange={setSetupChecked}
              testId="setupChecklist"
            />
          </div>
        </div>
        <div>
          <Button type="submit" testId="submitButton">
            <p>Next</p>
          </Button>
        </div>
      </form>
    </div>
  );

  const renderVideoCall = () => (
    <div className="min-w-sm">
      {!dailyUrl && (
        <h2 data-test="loadingVideoCall">
          Please wait for meeting to connect.
        </h2>
      )}
      {!showVideoCall && <h2>Videocall Disabled for testing.</h2>}
      {dailyUrl && showVideoCall && <HairCheck roomUrl={dailyUrl} />}

      {isDevelopment && (
        <div className="mt-6">
          <Button
            testId="showVideoCallButton"
            handleClick={() => setShowVideoCall(!showVideoCall)}
          >
            {showVideoCall ? "Hide VideoCall" : "Show Videocall"}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="">
      <H1>Check your webcam</H1>
      <P>Please take a minute to set up your space and check your webcam.</P>
      <div className="md:(flex space-x-4)">
        <div className="max-w-xl">{renderVideoCall()}</div>
        <div className="max-w-xl">{renderQuiz()}</div>
      </div>
    </div>
  );
}
