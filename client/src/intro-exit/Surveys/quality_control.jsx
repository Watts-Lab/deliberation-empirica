import React, { useState } from "react";
import SurveyWrapper from "../../components/SurveyWrapper";
import surveyJSON from './quality_control.json';

export default function quality_control({ next }) {
    return(
        <SurveyWrapper surveyJson={surveyJSON} next={next} />
    )
}