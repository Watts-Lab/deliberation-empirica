// The etherpad id is built from the game id and the name of the pad.
// This means that any player accessing the same padName will be accessing the same pad.
//
// Save contract: stagebook's Prompt element renders this component via the
// `renderSharedNotepad` slot for `shared + openResponse` prompts and does NOT
// wire a save path (text lives in Etherpad, not React state). On unmount we
// signal `etherpadDataReady`; the server callback then fetches the pad text
// and writes `prompt_${padName}` in stagebook's canonical prompt shape. We
// pass `progressLabel` + `stageTimeElapsed` through so the server-written
// record matches what stagebook decorates normal element saves with (see
// stagebook's Element.tsx wrappedSave).

import React, { useEffect, useRef } from "react";
import { usePlayer, useGame } from "@empirica/core/player/classic/react";
import { useProgressLabel, useGetElapsedTime } from "./progressLabel";

export function SharedNotepad({ padName, defaultText, rows }) {
  const game = useGame();
  const player = usePlayer();
  const progressLabel = useProgressLabel();
  const getElapsedTime = useGetElapsedTime();
  const hasLoggedUndefinedUrl = useRef(false);

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
        progressLabel,
        stageTimeElapsed: getElapsedTime(),
      });
    };
    // Effect is keyed on pad identity; the cleanup captures
    // progressLabel / getElapsedTime / game at the moment the pad ends,
    // which is what we want. Including those as deps would re-create
    // the pad on every stage transition — wrong.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [padId, padName]);

  const clientURL = game.get(padId);

  // Only log error once when URL is undefined
  if (!clientURL && !hasLoggedUndefinedUrl.current) {
    console.error(`Etherpad Client URL undefined for padId: ${padId}`);
    hasLoggedUndefinedUrl.current = true;
  } else if (clientURL && hasLoggedUndefinedUrl.current) {
    // Reset the flag when URL becomes available
    hasLoggedUndefinedUrl.current = false;
  }

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
    <div className="mt-4" data-testid="etherpad">
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
