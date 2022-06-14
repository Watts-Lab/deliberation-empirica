import React, { useState, useEffect } from "react";
import SurveyWrapper from "../../components/SurveyWrapper";
import surveyJSON from './quality_control.json';
import { usePlayer } from "@empirica/player";

export default function quality_control({ next }) {
    const player = usePlayer();

    if (player.get('tEnd2') === null) {
        const date = new Date(); 
        const time = date.getTime(); 
        player.set("tEnd2", time);
        player.set("tStart", player.get('tStart'))
    }

    const endT = player.get('tEnd2')
    const startT = player.get('tStart'); 

    console.log("start: " + startT); 
    console.log("end: " + endT);
    const timeElapsed = endT - startT; 
    const timeElapsedInHours = (timeElapsed / 3600000) * 15;
    const payment = timeElapsedInHours.toFixed(2);

    return(
        <div> 
            <SurveyWrapper surveyJson={surveyJSON} next={next} />
            <center> You have received ${payment} for participating in our experiment.</center>
        </div> 
        
    )
}