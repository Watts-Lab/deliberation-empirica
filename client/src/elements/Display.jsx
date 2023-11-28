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
import { P } from "../components/TextStyles";

function DisplayPlayerResponse({ promptName }) {
  console.log("DisplayPlayerResponse");
  const player = usePlayer();
  if (!player) return <P>Loading...</P>;

  const response = player.get(`prompt_${promptName}`);
  return response?.value;
}

function DisplayPositionResponse({ promptName, position }) {
  console.log("DisplayPositionResponse");
  const players = usePlayers();
  if (!players) return <P>Loading...</P>;

  const player = players.filter(
    (p) => parseInt(p.get("position")) === position
  )[0];
  if (!player) {
    console.log(`No player with position ${position}`);
  }
  const response = player.get(`prompt_${promptName}`);
  return response?.value;
}

function DisplaySharedResponse({ promptName }) {
  console.log("DisplaySharedResponse");
  const game = useGame();
  if (!game) return <P>Loading Shared Response...</P>;
  console.log(
    `Display game.get(prompt_${promptName}`,
    game.get(`prompt_${promptName}`)
  );
  const response = game.get(`prompt_${promptName}`);
  return response?.value;
}

export function Display({ promptName, position }) {
  return (
    <blockquote data-test={`display_${promptName}`}>
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
