import React, { useEffect } from "react";

import { usePlayer } from "@empirica/core/player/classic/react";
import { TextArea } from "../../components/TextArea";
import { CheckboxGroup } from "../../components/CheckboxGroup";
import { Button } from "../../components/Button";

const confirmations = [
  {
    key: "noOtherPrograms",
    value:
      "You have closed any other programs or browser tabs using the webcam (e.g. Zoom)",
  },
  {
    key: "refreshPage",
    value: "You have tried refreshing the page",
  },
  {
    key: "incognitoMode",
    value: "You have tried incognito/private browsing mode",
  },
  {
    key: "otherBrowser",
    value: "You have tried a different browser",
  },
];

const MODAL_STYLES = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  backgroundColor: "#FFF",
  padding: "20px",
  zIndex: 1000,
  borderRadius: "10px",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
};

export function FailureCode() {
  const player = usePlayer();
  const exitCodes = player?.get("exitCodes");
  const [browsersTried, setBrowsersTried] = React.useState(new Set());
  const [connectionRetries, setConnectionRetries] = React.useState(new Set());
  const [confirmationsChecked, setConfirmationsChecked] = React.useState([]);
  const [textAreaValue, setTextAreaValue] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);

  useEffect(() => {
    if (!player) return;
    const browserCollector = new Set();
    try {
      player.get("setupSteps").forEach((step) => {
        if ("browser" in step.debug) {
          setBrowsersTried((prev) => new Set([...prev, step.debug.browser]));
        }
        if (step.event === "callQuality" && step.value === "retrying") {
          setConnectionRetries(
            (prev) => new Set([...prev, step.debug.browser])
          );
        }
      });
    } catch (err) {
      console.error("Error getting setup steps", err);
    }
  }, [player]);

  useEffect(() => {
    console.log(
      "Browsers tried:",
      Array.from(browsersTried).join(", "),
      "Connection retries:",
      connectionRetries
    );
  }, [browsersTried, connectionRetries]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(exitCodes.failedEquipmentCheck);
    // eslint-disable-next-line no-alert
    alert(
      `Copied "${exitCodes.failedEquipmentCheck}" to clipboard. Please enter this code for a partial payment, then close the experiment window.`
    );
  };

  if (browsersTried.size < 2 || connectionRetries < 3) {
    return null; // Don't show if they haven't tried enough browsers or connection retries
  }

  return (
    <>
      <div className="fixed top-0 z-50 left-0 bottom-0 right-0 bg-gray-500 bg-opacity-70 " />

      <div style={MODAL_STYLES}>
        <h1>😳 Equipment and/or Connection Check Failed. </h1>
        <p>Please confirm that you have tried the following:</p>
        <CheckboxGroup
          options={confirmations}
          selected={confirmationsChecked}
          onChange={setConfirmationsChecked}
          testId="equipmentCheckConfirmations"
        />

        {confirmationsChecked.length === confirmations.length && (
          <div className="mt-4">
            To help us understand the issue, please visit this external
            troubleshooting page:
            <a
              href="https://network-test-v2.daily.co/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              {" https://network-test-v2.daily.co/ "}
            </a>
            and run the tests there. Then copy and paste the results below.
            <TextArea
              placeholder="Please describe any other troubleshooting steps you have tried."
              testId="equipmentCheckOtherTroubleshooting"
              onChange={(e) => setTextAreaValue(e.target.value)}
              value={textAreaValue}
            />
            <Button
              handleClick={() => {
                player.append("setupSteps", {
                  step: "failureCode",
                  event: "failureReported",
                  value: textAreaValue,
                  errors: [],
                  debug: {},
                  timestamp: new Date().toISOString(),
                });
                console.log("Failure code reported", textAreaValue);
                setSubmitted(true);
              }}
              className="mt-4"
            >
              Submit Test Results
            </Button>
          </div>
        )}

        {submitted && textAreaValue && (
          <div className="mt-4">
            <h3>🫤 Sorry you were not able to participate today.</h3>
            <p>
              We will review your network test results and try and find the
              problem.
            </p>
          </div>
        )}

        {submitted && textAreaValue && exitCodes !== "none" && (
          <div>
            <p>Please enter the following code to be paid for your time:</p>
            <div className="mt-4">
              <span className="font-bold font-mono text-center mr-2">
                {exitCodes.failedEquipmentCheck}
              </span>
              <Button
                handleClick={copyToClipboard}
                className="px-2 py-1 bg-blue-500 text-white text-xs rounded"
              >
                Copy to clipboard
              </Button>
            </div>
          </div>
        )}

        {submitted && textAreaValue && (
          <div className="mt-4">
            <p>You can now close this window.</p>
          </div>
        )}
      </div>
    </>
  );
}
