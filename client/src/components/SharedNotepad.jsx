// The etherpad id is built from the round id and the name of the pad.
// This means that any player accessing the same padName will be accessing the same pad.

import React, { useEffect } from "react";
import { usePlayer, useRound } from "@empirica/core/player/classic/react";

export function SharedNotepad({ padName, defaultText, record }) {
  const round = useRound();
  const player = usePlayer();

  const padId = `${padName}_${round.id}`.replace(/\s+/g, "_"); // replace one or more whitespaces with a single underscore

  useEffect(() => {
    console.log(`SharedNotepad: ${padId}`);
    round.set("newEtherpad", {
      padId,
      defaultText,
    });
    return () => {
      round.set("etherpadDataReady", {
        padId,
        padName,
        record,
      });
    };
  }, [padId]);

  const clientURL = round.get(padId);
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
        height="400px"
        style={{ border: "1px solid grey", "border-radius": "5px" }}
        // sandbox="allow-scripts allow-same-origin"
        src={padURL}
      />
    </div>
  );
}
