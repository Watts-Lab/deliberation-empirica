// Display takes arguments:
// reference: the reference to the prompt to display
// position: the position of the player to display the prompt from,
//           or "shared" for a shared prompt
//           or "player" for the current player

import React from "react";
import { useReferenceValues } from "../components/hooks";

export function Display({ promptName, reference, position }) {
  const values = useReferenceValues({
    reference: reference || `prompt.${promptName}`,
    position,
  });
  return (
    <blockquote
      data-test={`display_${reference}`}
      className="max-w-xl break-words p-4 my-4 border-l-4 border-gray-300 bg-gray-50"
    >
      {values.join("\n")}
    </blockquote>
  );
}
