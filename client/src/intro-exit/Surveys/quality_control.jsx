import React, { useEffect, useState } from "react";
import SurveyWrapper from "../../components/SurveyWrapper";
import surveyJSON from './quality_control.json';
import { usePlayer, useGame } from "@empirica/player";
import { useCallback } from "react";



export default function quality_control({ next }) {
    const player = usePlayer();
    const game = useGame();
    const [displayPayment, setDisplayPayment] = useState("calculating...");
    useEffect(() => {
        console.log("isPaidTime before" + player.get("isPaidTime"))
        player.set("isPaidTime", false); //stop paying participant when they get to this screen (so we can compute the time)
        console.log("isPaidTime after" + player.get("isPaidTime"))
        console.log("QC Exit. Played for " + player.get("activeMinutes") + " minutes, earned $" + player.get("dollarsOwed"))
    }, [])

    
    const dollarsOwed = player.get("dollarsOwed");
    useEffect(() => {
        setDisplayPayment(dollarsOwed)
        player.set("stopPaying", true);
    }, [dollarsOwed])
    return(
        <div>
            <div className="w-92 flex flex-col items-center">
                <h2 className="text-gray-700 font-medium">Thank you for participating!</h2>
                <p className="mt-2 text-gray-400 text-justify">
                    You will be paid $<strong data-test="dollarsOwed">{ displayPayment } </strong> for your time today.
                </p>
            </div>
            <SurveyWrapper surveyJson={surveyJSON} next={next} />
        </div>
    )
}