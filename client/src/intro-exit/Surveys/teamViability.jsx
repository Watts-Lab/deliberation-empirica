import React from "react";
import SurveyWrapper from "../../components/SurveyWrapper";
import surveyJson from "./teamViability.json"
import { usePlayer } from "@empirica/player";

export default function teamViability({ next, game }) {
    const player = usePlayer();

    let startTime = player.get("startTime");
    console.log(startTime);
    let endTime = player.get("endTime");
    console.log(endTime)
    const timeDiff = endTime - startTime;
    console.log(timeDiff);
    const hours = timeDiff / 6000000; 
    const pay = Math.round(hours * 15 * 100) / 100; 
     return(
        <div>
            <h1> Thank you for participating. For your time, you have received ${pay}. </h1>
            <SurveyWrapper surveyJson={surveyJson} next={next} />
        </div> 
    )
}