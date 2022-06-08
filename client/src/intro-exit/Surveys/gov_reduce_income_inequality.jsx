import React, { useState } from "react";
import SurveyWrapper from "../../components/SurveyWrapper";
import surveyJSON from './gov_reduce_income_inequality.json';

export default function ExampleExitSurvey({ next }) {
    return(
        <SurveyWrapper surveyJson={surveyJSON} next={next} />
    )
}