import React, { useEffect } from "react";
import SurveyWrapper from "../../components/SurveyWrapper";
import { usePlayer, useGame } from "@empirica/player";




export default function quality_control({ next }) {
    const player = usePlayer();
    const game = useGame();


    useEffect(() => { // runs on first mount
        console.log("Exit: QC Exit")
        player.set("paymentReady", false);
        player.set("isPaidTime", false); //stop paying participant when they get to this screen (so we can compute the time)
    }, [])

    if (player.get("paymentReady") && ! player.get("stopPaying") ) { //run only once!
        console.log("Played for " + player.get("activeMinutes") + " minutes, earned $" + player.get("dollarsOwed"));
        player.set("finalPayment", player.get("dollarsOwed"));
        player.set("stopPaying", true)
    }
    
    const displayPayment = player.get("paymentReady") ? player.get("dollarsOwed") : "calculating..."
    
    return(
        <div>
            <div className="w-92 flex flex-col items-center">
                <h2 className="text-gray-700 font-medium">Thank you for participating!</h2>
                <p className="mt-2 text-gray-400 text-justify">
                    You will be paid $<strong data-test="dollarsOwed">{ displayPayment } </strong> for your time today.
                </p>
            </div>
            <SurveyWrapper surveyJson={game.get("QCSurvey")} next={next} />
        </div>
    )
}
