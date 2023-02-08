import React, { useEffect, useState } from "react";
import { HairCheck } from "../components/HairCheck";
import { Button } from "../components/Button";
import { CheckboxGroup } from "../components/CheckboxGroup";
import { RadioGroup } from "../components/RadioGroup";
import { H1, P } from "../components/TextStyles";

export function VideoCheck({ next }) {
  const dailyUrl = "https://deliberation.daily.co/HairCheckRoom";

  const [webcamFound, setWebcamFound] = useState(undefined);
  const [optionsChecked, setOptionsChecked] = useState([]);
  const [webcamSuccess, setWebcamSuccess] = useState(!!window.Cypress);
  const [micFound, setMicFound] = useState(undefined);
  const [micSuccess, setMicSuccess] = useState(!!window.Cypress);
  const [soundPlayed, setSoundPlayed] = useState(!!window.Cypress);
  const [soundSelected, setSoundSelected] = useState("");

  const file = "westminster_quarters.mp3";
  const sound = new Audio(file);
  const chime = () => {
    sound.play();
    console.log(`Playing Audio: ${file}`);
    setSoundPlayed(true);
  };

  useEffect(() => {
    console.log("Intro: Video Check");
  }, []);

  return (
    <div className="grid justify-center">
      <div className="max-w-xl">
        {!webcamSuccess && <H1>📽 Now lets check your webcam...</H1>}
        {webcamSuccess && !micSuccess && (
          <H1>🎤 Please speak into your microphone</H1>
        )}
        {micSuccess && <H1>🔊 Now lets check your sound output... </H1>}
        <br />

        {!micSuccess && (
          <HairCheck
            roomUrl={dailyUrl}
            onVideoSuccess={setWebcamFound}
            onAudioSuccess={setMicFound}
            hideAudio={!webcamSuccess}
            hideVideo={webcamSuccess}
          />
        )}

        {webcamFound && !webcamSuccess && (
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
        )}

        {webcamFound === false && (
          <div>
            <H1>😳 Failed to detect webcam. </H1>
            <P>You may refresh the page to try again.</P>
            <P>
              If we are unable to detect your webcam, you will not be able to
              participate today. We hope you can join in the future!
            </P>
          </div>
        )}

        {webcamSuccess && micFound && !micSuccess && (
          <div>
            <Button
              testId="continueMic"
              handleClick={() => setMicSuccess(true)}
            >
              Continue
            </Button>
          </div>
        )}

        {micFound === false && (
          <div>
            <H1>😳 Failed to detect microphone. </H1>
            <P>You may refresh the page to try again.</P>
            <P>
              If we are unable to detect your microphone, you will not be able
              to participate today. We hope you can join in the future!
            </P>
          </div>
        )}

        {micSuccess && (
          <div>
            <Button testId="playSound" handleClick={chime}>
              Play Sound
            </Button>

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
        )}
      </div>
    </div>
  );
}
