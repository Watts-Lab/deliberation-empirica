import React from "react";
import SurveyWrapper from "../../components/SurveyWrapper";
import surveyJson from "./teamViability.json"

export default function teamViability({ next }) {
    return(
        <SurveyWrapper surveyJson={surveyJson} next={next} />
    )
}