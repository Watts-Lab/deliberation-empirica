// import { isDevelopment } from "@empirica/core/player";
import { usePlayer } from "@empirica/core/player/classic/react";
import React, { useEffect, useState } from "react";
import { HairCheck } from "../components/HairCheck";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { AudioElement } from "../elements/AudioElement";
import { CheckboxGroup } from "../components/CheckboxGroup";
import { H1, H3, P } from "../components/TextStyles";
import { DevConditionalRender } from "../components/Layouts";

export function VideoCheck({ next }) {
  const player = usePlayer();
  const dailyUrl = "https://deliberation.daily.co/HairCheckRoom";
  const chime = "westminster_quarters.mp3";
  const [setupChecked, setSetupChecked] = useState([]);
  const [incompleteResponse, setIncompleteResponse] = useState(false);
  const [nickname, setNickname] = useState("");
  const [audioSuccess, setAudioSuccess] = useState(!!window.Cypress);
  const [videoSuccess, setVideoSuccess] = useState(!!window.Cypress);
  
  

  // eslint-disable-next-line consistent-return -- not a mistake
  useEffect(() => {
    console.log("Intro: Video Check");
  }, []);

  function handleSubmit(event) {
    event.preventDefault();

    if (setupChecked.length === 4 && nickname && audioSuccess && videoSuccess) {
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
            Please make sure that you have provided a nickname, confirmed the
            following statements and completed mic and video check.
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
                  "I will not be interrupted for the next 45 minutes.",
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
      {!dailyUrl ? (
        <H3 data-test="loadingVideoCall">
          Please wait for meeting to connect. This should take ~30 seconds or
          less.
        </H3>
      ) : (
        <DevConditionalRender>
          <HairCheck
            roomUrl={dailyUrl}
            onAudioSuccess={() => setAudioSuccess(true)}
            onVideoSuccess={() => setVideoSuccess(true)}
          />
          <Button type="playAudioCheck" testId="checkAudioButton" handleClick={AudioElement({chime })}>
            <p>Play Audio</p>
          </Button>
        </DevConditionalRender>
      )}
    </div>
  );

  const renderAudioCheck = () =>(
    <div>
        
     </div>
  )

  return (
    <div className="">
      <H1>Check your webcam</H1>
      <P>Please take a minute to set up your space and check your webcam.</P>
      <div className="md:(flex space-x-4)">
        <div className="max-w-xl">{renderVideoCall()}</div>
        <div className="max-w-xl">{renderQuiz()}</div>
        <div className="max-w-xl">{renderAudioCheck()}</div>
      </div>
    </div>
  );
}
