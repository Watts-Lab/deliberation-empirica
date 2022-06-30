import React, {useEffect} from "react";
import { usePlayer } from "@empirica/player";
import { Button } from "../components/Button";

export function FinishedPayment({ next }) {
    const player = usePlayer(); 

    const endTime = player.get("timeAtGameEnd"); 
    console.log("endtime: " + endTime);

    const startTime = player.get("timeAtStart"); 
    console.log("starttime: " + startTime);
    
    const timeElapsed = endTime - startTime; 
    const timeElapsedInHours = (timeElapsed / 3600000) * 15;
    const payment = timeElapsedInHours.toFixed(2);

    useEffect(() => {
        setTimeout(() => {
          next()
        }, 5000)
      }, [])

    return (
        <div className="h-screen flex items-center justify-center">
            <div className="w-92 flex flex-col items-center">
                <h2 className="text-gray-700 font-medium">Finished</h2>
                <p className="mt-2 text-gray-400 text-justify">
                    Thank you for participating 
                </p>
                <p className="mt-2 text-gray-400 text-justify">
                You will be paid <strong data-test="paymentAmmount">${payment} </strong> for your time today
                </p>
            </div>
        </div>
    );
  }