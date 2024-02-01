// The etherpad id is built from the game id and the name of the pad.
// This means that any player accessing the same padName will be accessing the same pad.

import React, { useEffect } from "react";
import { usePlayer, useGame } from "@empirica/core/player/classic/react";

export function SharedNotepad({ padName, defaultText, record, rows }) {
  const game = useGame();
  const player = usePlayer();

  const padId = `${padName}_${game.id}`.replace(/\s+/g, "_"); // replace one or more whitespaces with a single underscore

  useEffect(() => {
    console.log(`SharedNotepad: ${padId}`);
    game.set("newEtherpad", {
      padId,
      defaultText,
    });
    return () => {
      game.set("etherpadDataReady", {
        padId,
        padName,
        record,
      });
    };
  }, [padId, padName]);

  const clientURL = game.get(padId);
  console.log(`Etherpad Client URL ${clientURL}`);
  if (!clientURL) return <p>Loading...</p>;

  const params = {
    userName: player.id,
    showLineNumbers: false,
    showControls: false,
    showChat: false,
    useMonospaceFont: false,
    noColors: true,
    alwaysShowChat: false,
    lang: "en",
    rtl: false,
    focusOnLine: 0,
  };

  const paramsObj = new URLSearchParams();
  Object.keys(params).forEach((key) => paramsObj.append(key, params[key]));

  const padURL = `${clientURL}?${paramsObj.toString()}`;

  return (
    <div className="mt-4" data-test="etherpad">
      <p>
        <em>
          This notepad is shared between you and the other members of your
          group.
        </em>
      </p>
      <iframe
        id={`position_${player.get("position")}_${padName}`}
        title="etherpad editor"
        width="100%"
        height={rows ? `${(rows + 1) * 30}px` : "400px"}
        style={{ border: "1px solid grey", borderRadius: "5px" }}
        // sandbox="allow-scripts allow-same-origin"
        src={padURL}
      />
    </div>
  );
}
