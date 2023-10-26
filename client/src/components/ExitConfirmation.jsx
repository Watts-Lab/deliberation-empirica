import React, { useState, useEffect } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Modal } from "./Modal";

export function ExitConfirmation() {
  const player = usePlayer();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
      setIsOpen(true);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  });

  if (!player) return null; // The player has not completed the ID screen, so let them exit
  if (player.get("playerComplete")) return null; // The player has already completed the exit survey, so let them exit

  function handlePlayerExit() {}

  function handlePlayerReturn() {}

  const buttons = [
    {
      label: "Return to the Study",
      onClick: handlePlayerReturn,
    },
    {
      label: "Withdraw from the Study",
      onClick: handlePlayerExit,
    },
  ];

  if (!player.get("introDone")) {
    // intro steps
    return <Modal></Modal>;
  }

  if (!player.get("assigned")) {
    // lobby
  }

  if (!player.get("ended")) {
    // game
  }
}
