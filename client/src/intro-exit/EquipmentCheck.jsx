// Its quite complicated to set up the video window, so even though
// we check the audio separately, we want to keep the daily connection
// open. So, we check everything here in the same component,
// even though the display is sequential.

import React, { useEffect, useState } from "react";
import { useGlobal, Loading } from "@empirica/core/player/react";
import { HairCheck } from "../components/HairCheck";
import { Button } from "../components/Button";
import { CheckboxGroup } from "../components/CheckboxGroup";
import { RadioGroup } from "../components/RadioGroup";
import { H1, P } from "../components/TextStyles";

export function EquipmentCheck({ next }) {
  const dailyUrl = "https://deliberation.daily.co/HairCheckRoom";

  const globals = useGlobal();
  const batchConfig = globals?.get("recruitingBatchConfig");
  const checkVideo = batchConfig?.checkVideo ?? true; // default to true if not specified
  const checkAudio = (batchConfig?.checkAudio ?? true) || checkVideo; // default to true if not specified, force true if checkVideo is true

  const [webcamFound, setWebcamFound] = useState(undefined);
  const [optionsChecked, setOptionsChecked] = useState([]);
  const [headphoneResponses, setHeadphoneResponses] = useState([]);
  const [webcamSuccess, setWebcamSuccess] = useState(!!window.Cypress); // In cypress tests, skip to the end.
  const [micFound, setMicFound] = useState(undefined);
  const [micSuccess, setMicSuccess] = useState(!!window.Cypress);
  const [soundPlayed, setSoundPlayed] = useState(!!window.Cypress);
  const [soundSelected, setSoundSelected] = useState("");

  const chime = () => {
    const file = "westminster_quarters.mp3";
    const sound = new Audio(file);
    sound.play();
    console.log(`Playing Audio: ${file}`);
    setSoundPlayed(true);
  };

  useEffect(() => {
    console.log("Intro: Video Check");
  }, []);

  const renderHeading = (checkName) => {
    if (checkName === "video") {
      return "📽 Now lets check your webcam...";
    }
    if (checkName === "audio") {
      return "🎤 Please speak into your microphone";
    }
    return "🔊 Now lets check your sound output... ";
  };

  const renderVideoCheck = () => {
    if (webcamFound) {
      return (
        <div>
          <P> Please confirm the following:</P>
          <br />
          <CheckboxGroup
            options={{
              see: "My head and shoulders are visible",
              background:
                "My background does not reveal anything I would like to keep private",
            }}
            selected={optionsChecked}
            onChange={setOptionsChecked}
            testId="setupChecklist"
          />
          <br />
          {optionsChecked.length === 2 && (
            <Button
              testId="continueWebcam"
              handleClick={() => setWebcamSuccess(true)}
            >
              Continue
            </Button>
          )}
        </div>
      );
    }
    if (webcamFound === false) {
      return (
        <div>
          <H1>😳 Failed to detect webcam. </H1>
          <P>You may refresh the page to try again.</P>
          <P>
            If we are unable to detect your webcam, you will not be able to
            participate today. We hope you can join in the future!
          </P>
        </div>
      );
    }
    return <></>;
  };

  const renderMicCheck = () => {
    if (micFound) {
      return (
        <div>
          <Button testId="continueMic" handleClick={() => setMicSuccess(true)}>
            Continue
          </Button>
        </div>
      );
    }
    if (micFound === false) {
      return (
        <div>
          <H1>😳 Failed to detect microphone. </H1>
          <P>You may refresh the page to try again.</P>
          <P>
            If we are unable to detect your microphone, you will not be able to
            participate today. We hope you can join in the future!
          </P>
        </div>
      );
    }
    return <></>;
  };

  const renderSoundCheck = () => {
    return (
      <div>
        <div className="mb-5">
          <P>
            Please put on headphones or earbuds to prevent your audio output
            from being picked up by your microphone. This helps us measure who
            is speaking.
          </P>

          <br />
          <CheckboxGroup
            options={{
              headphones: "I am wearing headphones or earbuds",
            }}
            selected={headphoneResponses}
            onChange={setHeadphoneResponses}
            testId="setupHeadphones"
          />
        </div>
        {headphoneResponses[0] && (
          <Button testId="playSound" handleClick={chime} className="mb-8">
            Play Sound
          </Button>
        )}

        {soundPlayed && (
          <div>
            <RadioGroup
              label="Please select which sound you heard playing:"
              options={{
                dog: "A dog barking",
                clock: "A clock chiming the hour",
                rooster: "A rooster crowing",
                count: "A person counting to ten",
                horse: "A horse galloping",
                door: "A door slamming",
              }}
              selected={soundSelected}
              onChange={(e) => setSoundSelected(e.target.value)}
              testId="soundSelect"
            />
            <br />

            {soundSelected === "clock" && (
              <Button testId="continueSpeakers" handleClick={() => next()}>
                Continue
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  // eslint-disable-next-line no-nested-ternary
  const checkName = !webcamSuccess ? "video" : !micSuccess ? "audio" : "sound";

  return (
    <div className="grid justify-center">
      <div className="max-w-xl">
        <H1>{renderHeading(checkName)}</H1>
        <br />

        {!micSuccess && (
          <HairCheck
            roomUrl={dailyUrl}
            onVideoSuccess={setWebcamFound}
            onAudioSuccess={setMicFound}
            hideAudio={checkName !== "audio"}
            hideVideo={checkName !== "video"}
          />
        )}

        {checkName === "video" && renderVideoCheck()}
        {checkName === "audio" && renderMicCheck()}
        {checkName === "sound" && renderSoundCheck()}
      </div>
    </div>
  );
}
