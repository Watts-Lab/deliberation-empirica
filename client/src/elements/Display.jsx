// Display takes arguments:
// promptName: the promptName of the prompt to display
// position: the position of the player to display the prompt from,
//           or "shared" for a shared prompt
//           or "player" for the current player

import {
  usePlayers,
  usePlayer,
  useGame,
} from "@empirica/core/player/classic/react";
import React from "react";

function DisplayPlayerResponse({ promptName }) {
  console.log("DisplayPlayerResponse");
  const player = usePlayer();
  if (!player) return <p>Loading...</p>;

  const response = player.get(`prompt_${promptName}`);
  return response?.value;
}

function DisplayPositionResponse({ promptName, position }) {
  const players = usePlayers();
  if (!players) return <p>Loading...</p>;

  const player = players.filter(
    (p) => parseInt(p.get("position")) === position
  )[0];

  if (!player) {
    console.error(
      `Trying to display ${promptName} for position ${position}, but there is no player at that position.`
    );
    return null;
  }

  const response = player.get(`prompt_${promptName}`);
  return response?.value;
}

function DisplaySharedResponse({ promptName }) {
  console.log("DisplaySharedResponse");
  const game = useGame();
  if (!game) return <p>Loading Shared Response...</p>;
  console.log(
    `Display game.get(prompt_${promptName}`,
    game.get(`prompt_${promptName}`)
  );
  const response = game.get(`prompt_${promptName}`);
  return response?.value;
}

export function Display({ promptName, position }) {
  return (
    <blockquote
      data-test={`display_${promptName}`}
      className="max-w-xl break-words p-4 my-4 border-l-4 border-gray-300 bg-gray-50"
    >
      {position === "shared" && (
        <DisplaySharedResponse promptName={promptName} />
      )}
      {position === "player" && (
        <DisplayPlayerResponse promptName={promptName} />
      )}
      {Number.isInteger(parseInt(position)) && (
        <DisplayPositionResponse promptName={promptName} position={position} />
      )}
    </blockquote>
  );
}
