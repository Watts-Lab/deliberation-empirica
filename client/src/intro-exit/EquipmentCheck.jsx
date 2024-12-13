/* eslint-disable no-nested-ternary */
// Its quite complicated to set up the video window, so even though
// we check the audio separately, we want to keep the daily connection
// open. So, we check everything here in the same component,
// even though the display is sequential.

import React, { useEffect, useState, useRef } from "react";
import { useGlobal } from "@empirica/core/player/react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { HairCheck } from "../components/HairCheck";
import { Button } from "../components/Button";
import { CheckboxGroup } from "../components/CheckboxGroup";
import { RadioGroup } from "../components/RadioGroup";

function VideoCheckMessage({ webcamFound, successCallback }) {
  const [optionsChecked, setOptionsChecked] = useState([]);
  if (webcamFound) {
    return (
      <div>
        <p> Please confirm that:</p>

        <CheckboxGroup
          options={[
            {
              key: "stable",
              value:
                "Your computer is sitting on a desk or table, not your lap",
            },
            {
              key: "background",
              value: "Your background reveals nothing private",
            },
            {
              key: "noOthers",
              value: "No other people will be seen on camera during the study",
            },
            { key: "see", value: "Your head and shoulders are visible" },
          ]}
          selected={optionsChecked}
          onChange={setOptionsChecked}
          testId="setupChecklist"
        />
        <br />
        <p className="text-gray-500 text-sm">
          These conditions are to protect your privacy and the privacy of others
          in your physical space.
        </p>
        <br />
        {optionsChecked.length === 4 && (
          <Button testId="continueWebcam" handleClick={successCallback}>
            Continue
          </Button>
        )}
      </div>
    );
  }
  if (webcamFound === false) {
    return <FailureMessage />;
  }
  return <CheckingConnectionMessage />;
}

function MicCheckMessage({ micFound, successCallback }) {
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
    return <FailureMessage />;
  }
  return undefined;
}

function SoundCheckMessage({ headphonesOnly, successCallback }) {
  const [headphoneResponses, setHeadphoneResponses] = useState([]);
  const [soundPlayed, setSoundPlayed] = useState(false);
  const [soundSelected, setSoundSelected] = useState("");
  const audioRef = useRef(null);

  const chime = () => {
    if (audioRef.current) {
      audioRef.current
        .play()
        .then(() => {
          console.log(`Playing Chime`);
          setSoundPlayed(true);
        })
        .catch((error) => {
          console.error("Error playing chime:", error);
        });
    }
  };

  return (
    <div>
      <audio ref={audioRef} preload="auto">
        <source src="westminster_quarters.mp3" type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>

      <div className="mb-5">
        <p>Please use headphones or earbuds.</p>
        {headphonesOnly && (
          <>
            <p>
              This helps us measure who is speaking, by preventing sound from
              your speakers from being picked up by your microphone.
            </p>

            <br />
            <CheckboxGroup
              options={[
                {
                  key: "wearingHeadphones",
                  value: "I am wearing headphones or earbuds",
                },
              ]}
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

function FailureMessage() {
  const player = usePlayer();
  const exitCodes = player?.get("exitCodes");
  return (
    <div>
      <h1>😳 Equipment and/or Connection Check Failed. </h1>
      <h3>Things to try:</h3>
      <ol>
        <li>
          Check that you have given this website permission to use the webcam
          and microphone.
        </li>
        <li>Move closer to your wifi router or use a wired connection.</li>
        <li>
          Close any other programs or browser tabs using the webcam (e.g. Zoom).
        </li>
        <li>Refresh the page and try again.</li>
        <li>Try incognito/private browsing mode.</li>
        <li>Try a different browser.</li>
      </ol>
      <p>
        If we are still unable to detect your equipment, you will not be able to
        participate today.{" "}
        {exitCodes !== "none" &&
          `Please enter the following code to be paid for your
        time: ${exitCodes.lobbyTimeout}`}
      </p>
    </div>
  );
}

function CheckingConnectionMessage() {
  return (
    <div>
      <h1>Checking Connection...</h1>
      <p>
        Please wait while we check your connection. This takes 10 seconds. ⏱️
      </p>
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

  const [failed, setFailed] = useState(false);

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
        <h1>{renderHeading()}</h1>
        <br />

        {!failed && (checkName === "webcam" || checkName === "mic") && (
          <HairCheck
            roomUrl="https://deliberation.daily.co/HairCheckRoom"
            onVideoSuccess={setWebcamFound}
            onAudioSuccess={setMicFound}
            hideAudio={checkName !== "mic"}
            hideVideo={checkName !== "webcam"}
            onFailure={() => {
              setFailed(true);
            }}
          />
        )}

        {!failed && checkName === "webcam" && (
          <VideoCheckMessage
            webcamFound={webcamFound}
            successCallback={() => setWebcamSuccess(true)}
          />
        )}
        {!failed && checkName === "mic" && (
          <MicCheckMessage
            micFound={micFound}
            successCallback={() => setMicSuccess(true)}
          />
        )}
        {!failed && checkName === "headphones" && (
          <SoundCheckMessage
            headphonesOnly={checkAudio}
            successCallback={next}
          />
        )}
        {failed && <FailureMessage />}
      </div>
    </div>
  );
}
