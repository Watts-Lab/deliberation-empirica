import { isDevelopment } from "@empirica/core/player";
import { usePlayer } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";

export function NoGamesWithSorry() {
  const player = usePlayer();

  if (!player) {
    useEffect(() => {
      // runs on first mount
      console.log("Page: No games available");
    }, []);

    // useEffect(() => {
    //   // runs on first mount
    //   const timer = setTimeout(() => {
    //     console.log("No games available pre-login");
    //   }, 500);
    //   return () => clearTimeout(timer);
    // }, []);

    // TODO: This should not display (even very quickly) if there are games
    // @npaton
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-92 flex flex-col items-center">
          <h2 className="text-gray-700 font-medium">
            No experiments available
          </h2>
          <p className="mt-2 text-gray-400 text-justify">
            There are currently no available experiments. Please wait until an
            experiment becomes available or come back at a later date.
          </p>
          {isDevelopment && (
            <p className="mt-4 text-gray-700">
              Go to&nbsp;
              <a
                href="/admin"
                target="empirica-admin"
                className="text-empirica-500"
              >
                Admin
              </a>
              &nbsp;to get started
            </p>
          )}
        </div>
      </div>
    );
  }

  // experiment has stopped in intro screens

  useEffect(() => {
    // runs on first mount
    // TODO: shouldn't need this timeout in new version
    // @npaton
    const timer = setTimeout(() => {
      console.log(
        "Experiment stoppped in intro screens, stopping payment counter"
      );
      player.set("playerComplete", true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const displayPayment = player.get("dollarsOwed") || "calculating...";

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="w-92 flex flex-col items-center">
        <h2 className="text-gray-500 font-medium">Experiment Unavailable</h2>
        <p className="mt-2 text-gray-400 text-justify">
          We are sorry, your experiment has unexpectedly stopped.&nbsp; We hope
          you can join us in a future experiment!
        </p>
        <p className="mt-2 text-gray-400 text-justify">
          You will be paid $
          <strong data-test="dollarsOwed">{displayPayment}</strong>
          &nbsp;for your time today.
        </p>
      </div>
    </div>
  );
}
