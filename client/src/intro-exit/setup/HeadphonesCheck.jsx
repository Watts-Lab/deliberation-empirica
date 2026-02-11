import React, { useState, useRef, useEffect } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { useDevices } from "@daily-co/daily-react";
import { Button } from "../../components/Button";
import { RadioGroup } from "../../components/RadioGroup";
import { Select } from "../../components/Select";

export function HeadphonesCheck({ setHeadphonesStatus, setErrorMessage }) {
  const player = usePlayer();
  const [headphonesReady, setHeadphonesReady] = useState(false);
  const [soundPlayed, setSoundPlayed] = useState(false);
  const [soundSelected, setSoundSelected] = useState("");
  const [speakerSelectionMode, setSpeakerSelectionMode] = useState("select"); // "select" | "testing"
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const [speakerIteration, setSpeakerIteration] = useState(0);
  const [noDevicesTimeout, setNoDevicesTimeout] = useState(false);
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

  const devices = useDevices();

  useEffect(() => {
    let timer;
    if (devices?.speakers?.length === 0) {
      timer = setTimeout(() => {
        setNoDevicesTimeout(true);
      }, 4000);
    } else {
      setNoDevicesTimeout(false);
    }
    return () => clearTimeout(timer);
  }, [devices]);

  useEffect(() => {
    if (noDevicesTimeout) {
      if (setErrorMessage) setErrorMessage("No sound output devices found.");
      setHeadphonesStatus("fail");
    } else if (headphonesReady === false) {
      // Only reset to waiting if we haven't started playing with things,
      // to avoid resetting active state if a device flickers?
      // Actually, if devices reappear, we probably want to let them continue.
      // But we shouldn't overwrite "pass".
      // setHeadphonesStatus("waiting") is default, so we mostly just want to clear fail.
      // Since specific statuses like local state aren't tracked in setHeadphonesStatus
      // until "pass", strictly clearing "fail" back to "waiting" is safe.
      setHeadphonesStatus("waiting");
    }
  }, [noDevicesTimeout, setHeadphonesStatus, setErrorMessage, headphonesReady]);

  const resetProgress = () => {
    setSoundPlayed(false);
    setSoundSelected("");
    setHeadphonesStatus("waiting");
  };

  const handleSpeakerSelected = (speaker) => {
    setActiveSpeaker(speaker);
    setSpeakerSelectionMode("testing");
    setSoundPlayed(false);
    setSoundSelected("");
  };

  const handleChangeSpeaker = () => {
    resetProgress();
    setActiveSpeaker(null);
    setSpeakerSelectionMode("select");
    setSpeakerIteration((v) => v + 1);
  };

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

      <div className="space-y-6">
        <section>
          <h1>Set up Headphones</h1>
          <h2>🎧 Step 1: Please put on headphones</h2>
          <p>
            This helps keep the audio clear and makes everyone’s conversation
            experience the same.
          </p>
          <Button
            className="mt-3"
            handleClick={() => setHeadphonesReady(true)}
            primary
            disabled={headphonesReady}
          >
            {headphonesReady ? "Headphones ready" : "I have headphones on"}
          </Button>
        </section>

        {headphonesReady && (
          <section>
            <h2>🎛 Step 2: Select those headphones</h2>
            {speakerSelectionMode === "testing" && activeSpeaker ? (
              <>
                <p>
                  Sound will play through:{" "}
                  <span className="font-semibold">{activeSpeaker.label}</span>
                </p>
                <div className="flex mt-2">
                  <Button handleClick={handleChangeSpeaker} primary={false}>
                    Choose a different device
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p>
                  Pick the output below that matches your headphones, so we know
                  what device to send audio to.
                </p>
                <SelectSpeaker
                  key={speakerIteration}
                  onSelected={handleSpeakerSelected}
                />
              </>
            )}
          </section>
        )}

        {headphonesReady && speakerSelectionMode === "testing" && (
          <section>
            <h2>🔊 Step 3: Make sure you can hear </h2>
            <p>Press play and tell us which sound you heard.</p>
            <Button testId="playSound" handleClick={chime} className="">
              Play Sound
            </Button>

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
                  <li>Are your headphones connected or paired?</li>
                  <li>Is the volume turned up?</li>
                  <li>Is this device selected as the output above?</li>
                </ul>
                <p>After checking these, please play the sound again.</p>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function SelectSpeaker({ onSelected }) {
  const devices = useDevices();
  const player = usePlayer();
  if (!devices || devices?.speakers === undefined)
    return <p>Loading sound outputs…</p>;

  if (devices?.speakers?.length < 1) return "No Sound Output Devices Found";

  const handleChange = (e) => {
    const selectedId = e.target.value;
    if (!selectedId) return;

    const logEntry = {
      step: "headphonesCheck",
      event: "selectSpeaker",
      errors: [],
      debug: {},
      timestamp: new Date().toISOString(),
    };
    try {
      devices.setSpeaker(selectedId);
      const selectedSpeaker = devices?.speakers?.find(
        (speaker) => speaker.device.deviceId === selectedId
      );
      const selectedLabel = selectedSpeaker?.device?.label || null;
      // Store both ID and label - label helps match devices when Safari rotates IDs
      player.set("speakerId", selectedId);
      player.set("speakerLabel", selectedLabel);
      logEntry.value = selectedId;
      logEntry.debug.selectedLabel = selectedLabel;
      onSelected?.({
        id: selectedId,
        label: selectedLabel || "Unknown output",
      });
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
        options={[
          {
            label: "Select an output...",
            value: "",
            disabled: true,
            hidden: true,
          },
          ...(devices?.speakers?.map((speaker) => ({
            label: speaker.device.label,
            value: speaker.device.deviceId,
          })) ?? []),
        ]}
        onChange={handleChange}
        value=""
        testId="speakerSelect"
      />
    </div>
  );
}
