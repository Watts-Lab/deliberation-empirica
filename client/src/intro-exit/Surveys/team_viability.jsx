import React, { useState } from "react";
import SurveyWrapper from "../../components/SurveyWrapper";
import surveyJSON from './team_viability.json';
import scoreFunc from "./team_viability.score.js";

export default function team_viability({ next }) {

    return(
        <SurveyWrapper surveyJson={surveyJSON} scoreFunc={scoreFunc} next={next} />
    )
}