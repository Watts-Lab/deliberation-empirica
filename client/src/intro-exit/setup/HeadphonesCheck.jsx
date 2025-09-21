import React, { useState, useRef, useEffect } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { useDevices } from "@daily-co/daily-react";
import { Button } from "../../components/Button";
import { RadioGroup } from "../../components/RadioGroup";
import { CheckboxGroup } from "../../components/CheckboxGroup";
import { Select } from "../../components/Select";

export function HeadphonesCheck({ setHeadphonesStatus }) {
  const player = usePlayer();
  const [headphoneResponses, setHeadphoneResponses] = useState([]);
  const [soundPlayed, setSoundPlayed] = useState(false);
  const [soundSelected, setSoundSelected] = useState("");
  const audioRef = useRef(null);

  useEffect(() => {
    if (soundPlayed && soundSelected) {
      const logEntry = {
        step: "headphonesCheck",
        event: "soundSelected",
        value: soundSelected,
        errors: [],
        debug: {},
        timestamp: new Date().toISOString(),
      };

      player.append("setupSteps", logEntry);
      console.log("Sound played successfully", logEntry);
      if (soundPlayed && soundSelected === "clock") {
        setHeadphonesStatus("pass");
      }
    }
  }, [soundPlayed, soundSelected, setHeadphonesStatus, player]);

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
    <div className="mt-8">
      <audio ref={audioRef} preload="auto">
        <source src="westminster_quarters.mp3" type="audio/mpeg" />
        We are having trouble playing the sound. Please try another output
        device.
      </audio>

      <div className="mb-5">
        <h2>🎧 Please put on headphones or earbuds.</h2>

        <SelectSpeaker />

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
      </div>

      {headphoneResponses.includes("wearingHeadphones") && (
        <Button testId="playSound" handleClick={chime} className="">
          Play Sound
        </Button>
      )}

      {soundPlayed && (
        <RadioGroup
          label="Please select which sound you heard playing:"
          options={[
            { key: "dog", value: "A dog barking" },
            { key: "clock", value: "A clock chiming the hour" },
            { key: "rooster", value: "A rooster crowing" },
            { key: "count", value: "A person counting to ten" },
            { key: "horse", value: "A horse galloping" },
            { key: "none", value: "I did not hear anything" },
          ]}
          selected={soundSelected}
          onChange={(e) => setSoundSelected(e.target.value)}
          testId="soundSelect"
        />
      )}

      {soundSelected === "none" && (
        <>
          <h2>🤔 Lets troubleshoot:</h2>
          <ul>
            <li>
              Are your headphones plugged in properly, or connected to
              bluetooth?
            </li>
            <li>Is the volume turned up?</li>
            <li>Do you have the right output selected?</li>
          </ul>
          <p>After checking these, please play the sound again.</p>
        </>
      )}
    </div>
  );
}

function SelectSpeaker() {
  const devices = useDevices();
  const player = usePlayer();
  if (devices?.speakers?.length < 1) return "No Sound Output Devices Found";

  const handleChange = (e) => {
    const logEntry = {
      step: "headphonesCheck",
      event: "selectSpeaker",
      errors: [],
      debug: {},
      timestamp: new Date().toISOString(),
    };
    try {
      devices.setSpeaker(e.target.value);
      logEntry.value = e.target.value;
    } catch (error) {
      logEntry.errors.push(error.message);
    } finally {
      player.append("setupSteps", logEntry);
      console.log("Speaker selected", logEntry);
    }
  };

  return (
    <div data-test="SpeakerSelection">
      <p>Please select which sound output device you wish to use:</p>
      <Select
        options={devices?.speakers?.map((speaker) => ({
          label: speaker.device.label,
          value: speaker.device.deviceId,
        }))}
        onChange={handleChange}
        testId="speakerSelect"
      />
    </div>
  );
}
