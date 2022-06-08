import React from "react";
import { usePlayer, isDevelopment, usePlayerID, useGame} from "@empirica/player";

export function NoGamesWithSorry(props) {
  // const player = props.player;
  // const round = props.round;
  const {currPlayer, round} = props;
  const [hasPlayer, onPlayerID] = usePlayerID();

  const player = usePlayer(); 

  if (!hasPlayer) {

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

  } else {

    if (sessionStorage.getItem('endTime') === null) {
      const date = new Date(); 
      const time = date.getTime(); 
      sessionStorage.setItem("endTime", time);
    }
  
    const endT = sessionStorage.getItem('endTime')
    const startT = sessionStorage.getItem('startTime'); 

    console.log("sorry start: " + startT); 
    console.log("sorry end: " + endT);
    const timeElapsed = endT - startT; 
    const timeElapsedInHours = (timeElapsed / 3600000) * 15;
    const payment = timeElapsedInHours.toFixed(2);

    return(
      <div className="h-screen flex items-center justify-center">
        <div className="w-92 flex flex-col items-center">
          <h2 className="text-gray-700 font-medium">Experiment Unavailable</h2>
          <p className="mt-2 text-gray-400 text-justify">
            Your experiment unexpectedly stopped. You have received ${payment} for participating in our experiment.
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
    )
  }

  


  return (
    <div className="md:min-w-100 md:min-h-160 lg:min-w-200 xl:min-w-400 flex flex-col items-center top:5px space-y-5">
    </div>
  );
}
