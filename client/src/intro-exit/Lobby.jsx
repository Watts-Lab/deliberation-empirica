import { usePlayer } from "@empirica/core/player/classic/react";
import React, { useState, useEffect } from "react";
import { Button } from "../components/Button";
import { useIdleContext } from "../components/IdleProvider";

const CYPRESS_LOBBY_TIMEOUT = 8 * 1000; // 8 seconds
const LOBBY_TIMEOUT = 10 * 60 * 1000; // 10 minutes
// const LOBBY_TIMEOUT = 10 * 1000; // 10 seconds

export function Lobby() {
  const player = usePlayer();
  const { setAllowIdle } = useIdleContext();
  const [lobbyTimeout, setLobbyTimeout] = useState(false);

  useEffect(() => {
    // Set allowIdle to true when the component loads
    setAllowIdle(true);
    console.log("Set Allow Idle");

    // Reset allowIdle to false when the component unloads
    return () => {
      setAllowIdle(false);
      console.log("Clear Allow Idle");
    };
  }, [setAllowIdle]);

  useEffect(() => {
    if (!lobbyTimeout) {
      let timeElapsed = 0;
      const timeout = window.Cypress ? CYPRESS_LOBBY_TIMEOUT : LOBBY_TIMEOUT;

      if (player.get("localTimeEnteredLobby")) {
        timeElapsed = Date.now() - player.get("localTimeEnteredLobby");
        if (timeElapsed > timeout) {
          setLobbyTimeout(true);
        }
      } else {
        console.log(`Lobby`);
        player.set("localTimeEnteredLobby", Date.now());
      }
      const timer = setTimeout(
        () => setLobbyTimeout(true),
        timeout - timeElapsed
      );
      return () => clearTimeout(timer); // Cleanup the timeout on unmount
    }
    return () => null;
  }, [player, lobbyTimeout]);

  const exitCodes = player.get("exitCodes");

  const renderInitialMessage = () => (
    <>
      <h3 className="mt-2 text-sm font-medium text-gray-900">
        Matching you with a group...
      </h3>
      <p>The study will proceed when all participants are ready.</p>
      <p>(This should be quick, but may take up to 10 minutes.)</p>
    </>
  );

  const copyToClipboard = () => {
    navigator.clipboard.writeText(exitCodes.lobbyTimeout);
    // eslint-disable-next-line no-alert
    alert(
      `Copied "${exitCodes.lobbyTimeout}" to clipboard. Please enter this code for a partial payment, then close the experiment window.`
    );
  };

  const renderTimeoutMessage = () => (
    <>
      <h3>
        {`🧐 Hmmm, it's taking longer than we expected to match you with a group.`}
      </h3>
      <p>You can either wait a bit longer, or leave the experiment.</p>

      <h3>If you choose to leave:</h3>
      <ol>
        {exitCodes !== "none" ? (
          <li>
            <div>
              <span className="mr-2">{`Enter code this code for a partial payout: "${exitCodes.lobbyTimeout}"`}</span>
              <Button
                handleClick={copyToClipboard}
                className="px-2 py-1 bg-blue-500 text-white text-xs rounded"
              >
                Copy to clipboard
              </Button>
            </div>
          </li>
        ) : null}
        <li>{`Close this window, so we don't keep trying to match you.`}</li>
      </ol>
    </>
  );

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 640 512"
          className="mx-auto h-12 w-12 text-gray-400"
          stroke="none"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M544 224c44.2 0 80-35.8 80-80s-35.8-80-80-80-80 35.8-80 80 35.8 80 80 80zm0-128c26.5 0 48 21.5 48 48s-21.5 48-48 48-48-21.5-48-48 21.5-48 48-48zM320 256c61.9 0 112-50.1 112-112S381.9 32 320 32 208 82.1 208 144s50.1 112 112 112zm0-192c44.1 0 80 35.9 80 80s-35.9 80-80 80-80-35.9-80-80 35.9-80 80-80zm244 192h-40c-15.2 0-29.3 4.8-41.1 12.9 9.4 6.4 17.9 13.9 25.4 22.4 4.9-2.1 10.2-3.3 15.7-3.3h40c24.2 0 44 21.5 44 48 0 8.8 7.2 16 16 16s16-7.2 16-16c0-44.1-34.1-80-76-80zM96 224c44.2 0 80-35.8 80-80s-35.8-80-80-80-80 35.8-80 80 35.8 80 80 80zm0-128c26.5 0 48 21.5 48 48s-21.5 48-48 48-48-21.5-48-48 21.5-48 48-48zm304.1 180c-33.4 0-41.7 12-80.1 12-38.4 0-46.7-12-80.1-12-36.3 0-71.6 16.2-92.3 46.9-12.4 18.4-19.6 40.5-19.6 64.3V432c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48v-44.8c0-23.8-7.2-45.9-19.6-64.3-20.7-30.7-56-46.9-92.3-46.9zM480 432c0 8.8-7.2 16-16 16H176c-8.8 0-16-7.2-16-16v-44.8c0-16.6 4.9-32.7 14.1-46.4 13.8-20.5 38.4-32.8 65.7-32.8 27.4 0 37.2 12 80.2 12s52.8-12 80.1-12c27.3 0 51.9 12.3 65.7 32.8 9.2 13.7 14.1 29.8 14.1 46.4V432zM157.1 268.9c-11.9-8.1-26-12.9-41.1-12.9H76c-41.9 0-76 35.9-76 80 0 8.8 7.2 16 16 16s16-7.2 16-16c0-26.5 19.8-48 44-48h40c5.5 0 10.8 1.2 15.7 3.3 7.5-8.5 16.1-16 25.4-22.4z" />
        </svg>
        {!lobbyTimeout && renderInitialMessage()}
        {lobbyTimeout && renderTimeoutMessage()}
      </div>
    </div>
  );
}
