import { usePlayer } from "@empirica/player";
import React, { useState } from "react";
import { render } from "react-dom";
import { Alert } from "../../components/Alert";
import { Button } from "../../components/Button";
import SurveyWrapper from "../../components/SurveyWrapper";
import surveyJSON from './ExampleSurvey.json';

export default function ExampleExitSurvey({ next }) {
    const player = usePlayer();

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

    // TODO: empirica callbacks on survey completion
    return(
        <div>
            <SurveyWrapper surveyJson={surveyJSON} next={next} />
            <center> You have received ${payment} for participating in our experiment.</center>
        </div>
    )
}
