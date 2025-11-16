import { createNewParticipant } from "@empirica/core/player";
import { Logo, useParticipantContext } from "@empirica/core/player/react";
import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

import { usePlayer, usePlayers } from "@empirica/core/player/classic/react";

export function EmpiricaMenu({ playerKey = "unknown" }) {
  useEffect(() => {
    console.log(`Display Empirica Button`);
  }, []);

  const ctx = useParticipantContext();
  const player = usePlayer();
  const players = usePlayers();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef(null);
  if (!ctx) return null;

  // This supports some cypress testing
  window.batchId = player?.get("batchId");
  window.batchLabel = player?.get("batchLabel");

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

  function submitStageForAllPlayers() {
    if (players && players.length > 0) {
      players.forEach((p) => {
        if (p.stage) {
          p.stage.set("submit", true);
        }
      });
    }
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const closeMenu = () => setMenuOpen(false);

  const menuContent = (
    <div
      ref={containerRef}
      className="fixed bottom-5 right-5 z-[2000] pointer-events-auto"
      data-test="empiricaMenu"
      data-player-id={playerKey}
    >
      <button
        type="button"
        onClick={toggleMenu}
        className="w-14 h-14 p-2 text-empirica-500 bg-white shadow rounded-lg focus:outline-none focus:ring-2 focus:ring-empirica-500"
        aria-label="Empirica controls"
        aria-expanded={menuOpen}
        aria-controls="empiricaMenuPanel"
        data-test="empiricaMenuToggle"
        data-player-id={playerKey}
      >
        <Logo />
      </button>
      <input
        data-test="playerPosition"
        value={player?.get("position")}
        hidden
      />
      <input data-test="playerName" value={player?.get("name")} hidden />
      <input
        data-test="playerDeliberationId"
        value={player?.get("participantData")?.deliberationId}
        hidden
      />
      {menuOpen && (
        <div
          id="empiricaMenuPanel"
          className="absolute bottom-16 right-0 rounded-lg overflow-hidden shadow-lg bg-white text-gray-600"
          data-test="hiddenMenu"
          data-player-id={playerKey}
        >
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
            <button
              onClick={submitStageForAllPlayers}
              type="button"
              className="whitespace-nowrap hover:text-empirica-600 w-full py-2 pl-4 pr-6 text-left"
              data-test="devSubmitStageForAll"
            >
              Submit Stage for All Players
            </button>
          </div>

          <div
            className="text-empirica-500 hover:text-empirica-600 bg-white flex justify-between items-center cursor-pointer"
            onClick={closeMenu}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") closeMenu();
            }}
          >
            <div className="px-4 text-lg font-medium w-full">Empirica</div>
            <div className="w-14 h-14 p-2 flex-shrink-0 bg-white">
              <Logo />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (typeof document === "undefined") return null;
  return ReactDOM.createPortal(menuContent, document.body);
}
