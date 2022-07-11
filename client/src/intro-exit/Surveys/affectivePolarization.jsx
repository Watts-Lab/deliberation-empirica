import React, { useState } from "react";
import SurveyWrapper from "../../components/SurveyWrapper";
import surveyJSON from './affectivePolarization.json';

export default function AffectivePolarization({ next }) {
    return(
        <SurveyWrapper surveyJson={surveyJSON} next={next} />
    )
}