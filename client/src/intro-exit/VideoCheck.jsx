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
  const [incompleteResponse, setIncompleteResponse] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(!isDevelopment);
  const [nickname, setNickname] = useState("");

  // eslint-disable-next-line consistent-return -- not a mistake
  useEffect(() => {
    console.log("Intro: Video Check");
  }, []);

  function handleSubmit(event) {
    event.preventDefault();

    if (setupChecked.length === 4 && nickname) {
      console.log("Videocheck complete");
      player.set("nickname", nickname);
      next();
    } else {
      console.log("Videocheck submitted incomplete");
      setIncompleteResponse(true);
    }

    if (incompleteResponse) {
      document.getElementById("alert").scrollIntoView(true);
    }
  }

  const renderQuiz = () => (
    <div>
      {incompleteResponse && (
        <div id="alert" className="my-5">
          <Alert title="Incomplete" kind="error">
            Please make sure that you have provided a nickname and confirmed the
            following statements.
          </Alert>
        </div>
      )}
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div>
          <H3>Please enter your first name, or a nickname.</H3>
          <P>This is the name that other participants will see.</P>
          <div className="ml-2 mt-2 space-y-1">
            <input
              className="mb-5 appearance-none block px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-empirica-500 focus:border-empirica-500 sm:text-sm"
              type="textarea"
              id="inputNickname"
              data-test="inputNickname"
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>

          <H3>Please confirm all of the following to continue.</H3>
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
        <H3 data-test="loadingVideoCall">
          Please wait for meeting to connect. This should take ~30 seconds or
          less.
        </H3>
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
