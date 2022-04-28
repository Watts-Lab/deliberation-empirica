import { usePlayer } from "@empirica/player";
import React, { useState } from "react";
import { render } from "react-dom";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { SurveyWrapper } from "../components/SurveyWrapper";
const surveyJSON = require('ExampleSurvey.json');

export function ExampleExitSurvey({ next }) {

    // TODO: empirica callbacks on survey completion
    return(
        <SurveyWrapper surveyJson={surveyJSON} />
    )
}