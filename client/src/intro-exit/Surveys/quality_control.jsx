import React, { useEffect } from "react";
import SurveyWrapper from "../../components/SurveyWrapper";
import surveyJSON from './quality_control.json';
import { usePlayer, useGame } from "@empirica/player";



export default function quality_control({ next }) {
    const player = usePlayer();
    const game = useGame();
    
    useEffect(() => {
        player.set("isPaidTime", false); //stop paying participant when they get to this screen (so we can compute the time)
        console.log("Played for " + player.get("activeMinutes") + " minutes, earned $" + player.get("dollarsOwed"))
    }, [])
    const dollarsOwed = player.get("dollarsOwed");

    return(
        <div>
            <h2>Thank you for participating</h2>
            <p> You will be paid ${ dollarsOwed } for your time today</p>
            <SurveyWrapper surveyJson={surveyJSON} next={next} />
        </div>
    )
}