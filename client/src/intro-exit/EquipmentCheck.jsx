/* eslint-disable no-nested-ternary */
// Its quite complicated to set up the video window, so even though
// we check the audio separately, we want to keep the daily connection
// open. So, we check everything here in the same component,
// even though the display is sequential.

import React, { useEffect, useState } from "react";
import { useGlobal } from "@empirica/core/player/react";
import { HairCheck } from "../components/HairCheck";
import { Button } from "../components/Button";
import { CheckboxGroup } from "../components/CheckboxGroup";
import { RadioGroup } from "../components/RadioGroup";
import { H1, P } from "../components/TextStyles";

function VideoCheck({ webcamFound, successCallback }) {
  const [optionsChecked, setOptionsChecked] = useState([]);
  if (webcamFound) {
    return (
      <div>
        <P> Please confirm that:</P>
        <br />
        <CheckboxGroup
          options={{
            background: "Your background reveals nothing private",
            noOthers: "No other people will be seen on camera",
            see: "Your head and shoulders are visible",
          }}
          selected={optionsChecked}
          onChange={setOptionsChecked}
          testId="setupChecklist"
        />
        <br />
        <p className="text-gray-500">
          These conditions are to protect your privacy and the privacy of others
          in your physical space.
        </p>
        <br />
        {optionsChecked.length === 3 && (
          <Button testId="continueWebcam" handleClick={successCallback}>
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
  return undefined;
}

function MicCheck({ micFound, successCallback }) {
  if (micFound) {
    return (
      <div>
        <Button testId="continueMic" handleClick={successCallback}>
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
  return undefined;
}

function SoundCheck({ headphonesOnly, successCallback }) {
  const [headphoneResponses, setHeadphoneResponses] = useState([]);
  const [soundPlayed, setSoundPlayed] = useState(false);
  const [soundSelected, setSoundSelected] = useState("");

  const chime = () => {
    const file = "westminster_quarters.mp3";
    const sound = new Audio(file);
    sound.play();
    console.log(`Playing Audio: ${file}`);
    setSoundPlayed(true);
  };

  return (
    <div>
      <div className="mb-5">
        <P>
          Please use headphones or earbuds, to ensure a consistent experience
          between participants.
        </P>
        {headphonesOnly && (
          <>
            <P>
              Using headphones prevents your sound output from being picked up
              by your microphone. This helps us measure who is speaking.
            </P>

            <br />
            <CheckboxGroup
              options={{
                wearingHeadphones: "I am wearing headphones or earbuds",
              }}
              selected={headphoneResponses}
              onChange={setHeadphoneResponses}
              testId="setupHeadphones"
            />
          </>
        )}
      </div>
      {(headphoneResponses.includes("wearingHeadphones") || // if headphones are not required, or if they are required and the user has indicated they are wearing them
        !headphonesOnly) && (
        <Button testId="playSound" handleClick={chime} className="mb-8">
          Play Sound
        </Button>
      )}

      {soundPlayed && (
        <div>
          <RadioGroup
            label="Please select which sound you heard playing:"
            options={[
              { key: "dog", value: "A dog barking" },
              { key: "clock", value: "A clock chiming the hour" },
              { key: "rooster", value: "A rooster crowing" },
              { key: "count", value: "A person counting to ten" },
              { key: "horse", value: "A horse galloping" },
              { key: "door", value: "A door slamming" },
            ]}
            selected={soundSelected}
            onChange={(e) => setSoundSelected(e.target.value)}
            testId="soundSelect"
          />
          <br />

          {soundSelected === "clock" && (
            <Button testId="continueSpeakers" handleClick={successCallback}>
              Continue
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function EquipmentCheck({ next }) {
  const globals = useGlobal();
  const batchConfig = globals?.get("recruitingBatchConfig");
  const checkVideo = batchConfig?.checkVideo ?? true; // default to true if not specified
  const checkAudio = (batchConfig?.checkAudio ?? true) || checkVideo; // default to true if not specified, force true if checkVideo is true

  const [webcamFound, setWebcamFound] = useState(undefined); // status of webcam
  const [micFound, setMicFound] = useState(undefined);

  const [webcamSuccess, setWebcamSuccess] = useState(!!window.Cypress); // In cypress tests, skip to the end.
  const [micSuccess, setMicSuccess] = useState(!!window.Cypress);

  let checkName = "webcam";
  if (webcamSuccess || !checkVideo) checkName = "mic";
  if (micSuccess || !checkAudio) checkName = "headphones";

  useEffect(() => {
    console.log("Intro: Video Check");
  }, []);

  const renderHeading = () => {
    if (checkName === "webcam") {
      return "📽 Now lets check your webcam...";
    }
    if (checkName === "mic") {
      return "🎤 Please speak into your microphone";
    }
    if (checkName === "headphones") {
      return "🔊 Now lets check your sound output... ";
    }
    return undefined;
  };

  return (
    <div className="grid justify-center">
      <div className="max-w-xl">
        <H1>{renderHeading()}</H1>
        <br />

        {(checkName === "webcam" || checkName === "mic") && (
          <HairCheck
            roomUrl="https://deliberation.daily.co/HairCheckRoom"
            onVideoSuccess={setWebcamFound}
            onAudioSuccess={setMicFound}
            hideAudio={checkName !== "mic"}
            hideVideo={checkName !== "webcam"}
          />
        )}

        {checkName === "webcam" && (
          <VideoCheck
            webcamFound={webcamFound}
            successCallback={() => setWebcamSuccess(true)}
          />
        )}
        {checkName === "mic" && (
          <MicCheck
            micFound={micFound}
            successCallback={() => setMicSuccess(true)}
          />
        )}
        {checkName === "headphones" && (
          <SoundCheck headphonesOnly={checkAudio} successCallback={next} />
        )}
      </div>
    </div>
  );
}
