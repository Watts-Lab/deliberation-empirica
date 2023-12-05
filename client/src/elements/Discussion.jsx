/* eslint-disable no-restricted-syntax */
import {
  useGame,
  useStage,
  usePlayers,
  usePlayer,
} from "@empirica/core/player/classic/react";
import React, { useState } from "react";
import { VideoCall } from "../components/VideoCall";
import { DevConditionalRender } from "../components/Layouts";
import { TextChat } from "../components/TextChat";
import { Button } from "../components/Button";
import { RadioGroup } from "../components/RadioGroup";
import { H1 } from "../components/TextStyles";

export function Discussion({ chatType, showNickname, showTitle }) {
  const stage = useStage();

  if (chatType !== "video" && chatType !== "text") {
    console.error(`Invalid chat type: ${chatType}`);
    return null;
  }

  const renderVideoChat = () => (
    <>
      <DevConditionalRender>
        <VideoCall showNickname={showNickname} showTitle={showTitle} record />;
      </DevConditionalRender>
      <ReportParticipantMissing />
      <MissingParticipantRespond />
    </>
  );

  return (
    <div className="relative min-h-sm h-full" data-test="discussion">
      {chatType === "video" && renderVideoChat()}
      {chatType === "text" && (
        <TextChat
          scope={stage}
          attribute="textChat"
          showNickname={showNickname}
          showTitle={showTitle}
        />
      )}
    </div>
  );
}

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

function MissingParticipantRespond() {
  const player = usePlayer();
  const game = useGame();

  if (!player || !game) return null; // wait for hooks to load

  const checkInRequests = game.get("checkInRequests") || []; // array of timestamps
  const lastCheckInRequest = checkInRequests.at(-1);
  if (!lastCheckInRequest) return null; // don't show if there is no check in request

  const checkIns = player.get("checkIns") || []; // array of timestamps
  const lastCheckIn = checkIns.at(-1);
  if (lastCheckIn && lastCheckIn > lastCheckInRequest - 1000 * 60) return null; // don't show if they checked in after the last request (or up to 10 seconds prior)

  const checkIn = () => {
    console.log("Checked in");
    player.append("checkIns", Date.now());
  };

  return (
    <>
      <div className="fixed top-0 z-50 left-0 bottom-0 right-0 bg-gray-500 bg-opacity-70 " />
      <div style={MODAL_STYLES}>
        <H1>Are you there?</H1>
        <p>We hate to leave people with nobody to talk to. 🙂</p>
        <p className="text-red-500">Please respond within 60 seconds</p>

        <div className="flex justify-center mt-4 space-x-2">
          <Button className="inline-flex" handleClick={checkIn}>
            I'm here!
          </Button>
        </div>
      </div>
    </>
  );
}

function timeoutCheckIn(game, players) {
  const checkInRequests = game.get("checkInRequests") || [];
  const lastCheckInRequest = checkInRequests.at(-1);
  let checkedIn = 0;
  for (const player of players) {
    const checkIns = player.get("checkIns") || []; // array of timestamps
    const lastCheckIn = checkIns.at(-1);
    if (lastCheckIn > lastCheckInRequest - 1000 * 10)
      // 10 second buffer
      checkedIn += 1;
  }
  console.log(`${checkedIn} players checked in`);
  if (checkedIn < 2) {
    console.log("Ending discussion due to lack of participants");
    for (const player of players) {
      player.stage.set("submit", true);
    }
  }
}

function ReportParticipantMissing() {
  const player = usePlayer();
  const players = usePlayers();
  const game = useGame();

  const [modalOpen, setModalOpen] = useState(false);
  const [missingDetails, setMissingDetails] = useState("");

  const handleSubmit = () => {
    player.append("reports", {
      code: missingDetails,
      timestamp: Date.now(),
    });
    player.append("checkIns", Date.now());
    if (missingDetails === "noDiscussant" || missingDetails === "onlyOne") {
      game.append("checkInRequests", Date.now());
      setTimeout(() => timeoutCheckIn(game, players), 1000 * 60);
      console.log("Requested Check In");
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
                We will wait 60 seconds for others to arrive, otherwise we will
                end the discussion.
              </p>
            )}

            {missingDetails === "noDiscussant" && (
              <p className="text-sm text-red-500">
                We will give the others 60 seconds to confirm their presence, or
                we will end the discussion.
              </p>
            )}

            {missingDetails === "playerAbsent" && (
              <p className="text-sm text-red-500">
                Thanks for letting us know. We will continue the discussion with
                the existing participants.
              </p>
            )}

            <div className="flex justify-center mt-4 space-x-2">
              <Button className="inline-flex" handleClick={handleSubmit}>
                Submit
              </Button>
              <Button
                className="inline-flex"
                handleClick={() => {
                  setModalOpen(false);
                  setMissingDetails("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
