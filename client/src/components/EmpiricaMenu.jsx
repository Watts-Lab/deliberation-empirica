import { createNewParticipant } from "@empirica/core/player";
import { Logo, useParticipantContext } from "@empirica/core/player/react";
import React, { useEffect } from "react";

import { usePlayer } from "@empirica/core/player/classic/react";

export function EmpiricaMenu() {
  useEffect(() => {
    console.log(`Display Empirica Button`);
  }, []);

  const ctx = useParticipantContext();
  const player = usePlayer();

  if (!ctx) {
    return null;
  }

  function resetSession() {
    ctx.session.clearSession();
    window.location.reload();
  }

  function skipIntro() {
    if (player) {
      player.set("introDone", true);
    }
  }

  function submitStage() {
    if (player.stage) {
      player.stage.set("submit", true);
    }
  }

  return (
    <div
      className="group fixed top-full left-full -mt-20 -ml-20 rounded-lg bg-white z-20"
      data-test="empiricaMenu"
    >
      <div className="w-14 h-14 p-2  text-empirica-500 shadow rounded-lg group-hover:shadow-none">
        <Logo />
      </div>
      <div
        className="hidden group-hover:block absolute rounded-lg overflow-hidden bottom-0 right-0 shadow"
        data-test="hiddenMenu"
      >
        <div className="text-gray-400 bg-gray-100  overflow-hidden">
          <div>
            <button
              onClick={() => createNewParticipant("playerKey")}
              type="button"
              className="whitespace-nowrap hover:text-empirica-600 w-full py-2 pl-4 pr-6 text-left"
            >
              New Player
            </button>
            <button
              onClick={resetSession}
              type="button"
              className="whitespace-nowrap hover:text-empirica-600 w-full py-2 pl-4 pr-6 text-left"
            >
              Reset Current Session
            </button>
            <button
              onClick={skipIntro}
              type="button"
              className="whitespace-nowrap hover:text-empirica-600 w-full py-2 pl-4 pr-6 text-left"
              data-test="devSkipIntro"
            >
              Skip Intro Steps
            </button>
            <button
              onClick={submitStage}
              type="button"
              className="whitespace-nowrap hover:text-empirica-600 w-full py-2 pl-4 pr-6 text-left"
              data-test="devSubmitStage"
            >
              Submit Stage
            </button>
          </div>

          <div className="text-empirica-500 hover:text-empirica-600 bg-white flex justify-between items-center cursor-pointer">
            <div className="px-4 text-lg font-medium w-full">Empirica</div>
            <div className="w-14 h-14 p-2 flex-shrink-0 bg-white">
              <Logo />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
