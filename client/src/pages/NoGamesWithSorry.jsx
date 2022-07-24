import React, { useEffect, useRef } from "react";
import { usePlayer, isDevelopment, usePlayerID} from "@empirica/player";

export function NoGamesWithSorry() {
  const [hasPlayer, onPlayerID] = usePlayerID();


  if (!hasPlayer) {
    useEffect(() => { // runs on first mount
      const timer = setTimeout(() => {
        console.log("No games available pre-login")
    }, 500)
    return () => clearTimeout(timer);
  }, [])

    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-92 flex flex-col items-center">
          <h2 className="text-gray-700 font-medium">No experiments available</h2>
          <p className="mt-2 text-gray-400 text-justify">
            There are currently no available experiments. Please wait until an
            experiment becomes available or come back at a later date.
          </p>
          {isDevelopment ? (
            <p className="mt-4 text-gray-700">
              Go to{" "}
              <a
                href="/admin"
                target="empirica-admin"
                className="text-empirica-500"
              >
                Admin
              </a>{" "}
              to get started
            </p>
          ) : (
            ""
          )}
        </div>
      </div>
    );

  } else { // experiment has stopped in intro screens
    
    const player = usePlayer(); 

    useEffect(() => { // runs on first mount
      const timer = setTimeout(() => {
        console.log("Experiment stoppped in intro screens, stopping payment counter")
        player.set("playerComplete", true)
      }, 500)
      return () => clearTimeout(timer);
    }, [])
  
    const displayPayment = player.get("dollarsOwed") || "calculating..."

    return(
      <div className="h-screen flex items-center justify-center">
        <div className="w-92 flex flex-col items-center">
          <h2 className="text-gray-700 font-medium">Experiment Unavailable</h2>
          <p className="mt-2 text-gray-400 text-justify">
            We are sorry, your experiment has unexpectedly stopped. 
            We hope you can join us in a future experiment!
          </p>
          <p className="mt-2 text-gray-400 text-justify">
            You will be paid $<strong data-test="dollarsOwed">{ displayPayment } </strong> for your time today.
          </p>
        </div>
      </div>
    )
  }
}