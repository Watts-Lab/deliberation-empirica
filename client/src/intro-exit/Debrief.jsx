/*
Debrief page:
Shows custom or generic debrief content, exit code, and close prompt.
*/

import React from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { useGlobal } from "@empirica/core/player/react";
import { Button, Loading } from "stagebook/components";
import { Markdown } from "../components/Markdown";
import { useText } from "../components/hooks";
import { useAllowIdle } from "../components/IdleProvider";

export function Debrief() {
  const player = usePlayer();
  const globals = useGlobal();
  useAllowIdle();

  const batchConfig = globals?.get("recruitingBatchConfig");
  const debriefPath =
    batchConfig?.debrief && batchConfig.debrief !== "none"
      ? batchConfig.debrief
      : null;
  const { text: debriefText, error: debriefError } = useText({
    file: debriefPath,
  });

  if (!player) {
    return <Loading />;
  }

  const exitCodes = player.get("exitCodes");
  const debriefLoading =
    debriefPath && debriefText === undefined && !debriefError;
  const debriefContent = debriefPath
    ? (debriefText ?? "Thank you for participating.")
    : "Thank you for participating.";

  const copyToClipboard = () => {
    navigator.clipboard.writeText(exitCodes.complete);
    // eslint-disable-next-line no-alert
    alert(
      `Copied "${exitCodes.complete}" to clipboard. Please enter this code to receive payment, then close the experiment window.`,
    );
  };

  return (
    <div className="grid justify-center">
      <h1>
        <span role="img" aria-label="Party popper">
          Finished! 🎉
        </span>{" "}
        Thank you for participating!
      </h1>
      {exitCodes !== "none" && (
        <div>
          <h3>
            Please enter the following completion code on your recruitment
            platform:
          </h3>
          <div className="mt-4">
            <span className="font-bold font-mono text-center mr-2">
              {exitCodes?.complete}
            </span>
            <Button
              onClick={copyToClipboard}
              className="px-2 py-1 bg-blue-500 text-white text-xs rounded"
            >
              Copy to clipboard
            </Button>
          </div>
        </div>
      )}

      {debriefLoading ? <Loading /> : <Markdown text={debriefContent} />}

      <h3>You may now close this window.</h3>
    </div>
  );
}
