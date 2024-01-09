/* eslint-disable no-restricted-syntax */
import React, { useState } from "react";
import {
  useGame,
  usePlayer,
  usePlayers,
  useStageTimer,
} from "@empirica/core/player/classic/react";
import { Button } from "./Button";
import { RadioGroup } from "./RadioGroup";
import { H1 } from "./TextStyles";
import { useProgressLabel } from "./utils";

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

export function ReportMissing() {
  const timeout = !window.Cypress ? 60 : 5; // seconds
  const gracePeriod = !window.Cypress ? 10 : 2; // seconds
  return (
    <>
      <ReportParticipantMissing timeout={timeout} gracePeriod={gracePeriod} />
      <MissingParticipantRespond timeout={timeout} gracePeriod={gracePeriod} />
    </>
  );
}

function MissingParticipantRespond({ timeout, gracePeriod }) {
  const player = usePlayer();
  const game = useGame();
  const stageTimer = useStageTimer();
  const stageElapsed = (stageTimer?.elapsed || 0) / 1000;
  const progressLabel = useProgressLabel();

  if (!player || !game) return null; // wait for hooks to load

  const checkInRequests = game.get("checkInRequests") || [];
  const lastCheckInRequest = checkInRequests.at(-1);
  if (!lastCheckInRequest || lastCheckInRequest.stage !== progressLabel)
    return null; // don't show if there is no check in request this stage

  const checkIns = player.get("checkIns") || [];
  const lastCheckIn = checkIns.at(-1);
  if (
    lastCheckIn &&
    lastCheckIn.stage === progressLabel &&
    lastCheckIn.timestamp > lastCheckInRequest.timestamp - gracePeriod
  )
    return null; // don't show if they checked in after the last request (or some gracePeriod seconds *prior*)

  const checkIn = () => {
    console.log("Checked in");
    player.append("checkIns", {
      stage: progressLabel,
      timestamp: stageElapsed,
    });
  };

  const timeRemaining = Math.max(
    Math.floor(timeout - (stageElapsed - lastCheckInRequest.timestamp)),
    0
  );

  return (
    <>
      <div className="fixed top-0 z-50 left-0 bottom-0 right-0 bg-gray-500 bg-opacity-70 " />
      <div style={MODAL_STYLES}>
        <H1>Are you there?</H1>
        <p>We hate to leave people with nobody to talk to. 🙂</p>
        <p className="text-red-500">{`Please respond within ${timeRemaining} seconds`}</p>

        <div className="flex justify-center mt-4 space-x-2">
          <Button
            className="inline-flex"
            handleClick={checkIn}
            testId="checkIn"
          >
            I'm here!
          </Button>
        </div>
      </div>
    </>
  );
}

function passedCheckIn(game, players, gracePeriod) {
  const checkInRequests = game.get("checkInRequests") || [];
  const lastCheckInRequest = checkInRequests.at(-1);
  let checkedIn = 0;
  for (const player of players) {
    const checkIns = player.get("checkIns") || [];
    const lastCheckIn = checkIns.at(-1);
    if (
      lastCheckIn &&
      lastCheckIn.stage === lastCheckInRequest.stage &&
      lastCheckIn.timestamp > lastCheckInRequest.timestamp - gracePeriod
    )
      // count checkIns after the last request (or up to 10 seconds prior, as buffer)
      checkedIn += 1;
  }
  console.log(`${checkedIn} players checked in`);
  return checkedIn >= 2;
}

function timeoutCheckIn(game, players, gracePeriod) {
  if (!passedCheckIn(game, players, gracePeriod)) {
    console.log("Ending discussion due to lack of participants");
    for (const player of players) {
      player.stage.set("submit", true);
    }
  }
}

function ReportParticipantMissing({ timeout, gracePeriod }) {
  const player = usePlayer();
  const players = usePlayers();
  const game = useGame();
  const stageTimer = useStageTimer();
  const stageElapsed = (stageTimer?.elapsed || 0) / 1000;
  const progressLabel = useProgressLabel();

  const [modalOpen, setModalOpen] = useState(false);
  const [waitingToastOpen, setWaitingToastOpen] = useState(false);
  const [successToastOpen, setSuccessToastOpen] = useState(false);
  const [missingDetails, setMissingDetails] = useState("");
  const [timeResponseRequested, setTimeResponseRequested] = useState(undefined);
  const [responseTimer, setResponseTimer] = useState(undefined);

  if (waitingToastOpen && passedCheckIn(game, players, gracePeriod)) {
    setWaitingToastOpen(false);
    clearTimeout(responseTimer);
    setTimeResponseRequested(undefined);
    setSuccessToastOpen(true);
    setTimeout(() => setSuccessToastOpen(false), 5000);
  }

  const handleSubmit = () => {
    player.append("reports", {
      code: missingDetails,
      stage: progressLabel,
      timestamp: stageElapsed,
    });

    player.append("checkIns", {
      stage: progressLabel,
      timestamp: stageElapsed,
    });

    game.append("checkInRequests", {
      stage: progressLabel,
      timestamp: stageElapsed,
    });
    console.log("Requested Check In");

    // Always request a check-in if a participant reports missing players,
    // but only queue to advance stage if they select that they have nobody
    // to talk to.
    if (missingDetails === "noDiscussant" || missingDetails === "onlyOne") {
      setResponseTimer(
        setTimeout(
          () => timeoutCheckIn(game, players, gracePeriod),
          1000 * timeout
        )
      );
      setWaitingToastOpen(true);
      if (!timeResponseRequested) setTimeResponseRequested(stageElapsed); // don't restart an existing timer
    }
    setModalOpen(false);
    setMissingDetails("");
  };

  return (
    <>
      <Button
        className="absolute z-40 right-0 bottom-0 m-3"
        testId="reportMissing"
        handleClick={() => setModalOpen(true)}
      >
        Report Missing Participant
      </Button>

      {modalOpen && (
        <>
          <div className="fixed top-0 z-50 left-0 bottom-0 right-0 bg-gray-500 bg-opacity-70 " />
          <div style={MODAL_STYLES}>
            <H1>Report Missing Participant</H1>
            <p>Which of these best describes the situation?</p>
            <RadioGroup
              options={[
                {
                  key: "onlyOne",
                  value: "I am the only one in the video call.",
                },
                {
                  key: "noDiscussant",
                  value:
                    "Nobody else in the call is participating in the discussion.",
                },
                {
                  key: "playerAbsent",
                  value:
                    "Not everybody is participating in the discussion, but I still have someone to talk with.",
                },
              ]}
              selected={missingDetails}
              onChange={(e) => setMissingDetails(e.target.value)}
              testId="missingDetails"
            />

            {missingDetails === "onlyOne" && (
              <p className="text-sm text-red-500">
                {`We will wait ${timeout} seconds for others to arrive, otherwise we will
                end the discussion.`}
              </p>
            )}

            {missingDetails === "noDiscussant" && (
              <p className="text-sm text-red-500">
                {`We will give the others ${timeout} seconds to confirm their presence, or
                we will end the discussion.`}
              </p>
            )}

            {missingDetails === "playerAbsent" && (
              <p className="text-sm text-red-500">
                Thanks for letting us know. We will ask the others to confirm
                their presence and continue the discussion.
              </p>
            )}

            <div className="flex justify-center mt-4 space-x-2">
              <Button
                className="inline-flex"
                handleClick={handleSubmit}
                testId="submitReportMissing"
              >
                Submit
              </Button>
              <Button
                className="inline-flex"
                handleClick={() => {
                  setModalOpen(false);
                  setMissingDetails("");
                }}
                testId="cancelReportMissing"
              >
                Cancel
              </Button>
            </div>
          </div>
        </>
      )}

      {waitingToastOpen && (
        <div className="fixed bottom-20 right-20 w-80 h-20 bg-opacity-75 bg-red-500 text-center align-middle flex flex-col items-center justify-center rounded-lg">
          <p>Asking others to confirm their presence.</p>
          <p>
            {Math.max(
              0,
              Math.floor(timeout - (stageElapsed - timeResponseRequested))
            )}{" "}
            seconds remaining.
          </p>
        </div>
      )}

      {successToastOpen && (
        <div className="fixed bottom-20 right-20 w-80 h-20 bg-opacity-75 bg-green-500 text-center align-middle flex flex-col items-center justify-center rounded-lg">
          <p>At least one other person has confirmed their presence.</p>
        </div>
      )}
    </>
  );
}
