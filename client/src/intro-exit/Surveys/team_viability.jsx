import React, { useState } from "react";
import SurveyWrapper from "../../components/SurveyWrapper";
import surveyJSON from './team_viability.json';

export default function team_viability({ next }) {
    return(
        <SurveyWrapper surveyJson={surveyJSON} next={next} />
    )
}