import React from "react";
import SurveyWrapper from "../../components/SurveyWrapper";
import surveyJson from "./QCSurvey.json"

export default function QCSurvey({ next }) {
    return(
        <SurveyWrapper surveyJson={surveyJson} next={next} />
    )
}