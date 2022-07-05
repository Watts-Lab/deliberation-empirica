import React from "react";
import SurveyWrapper from "../components/SurveyWrapper";
import surveyJSON from '../intro-exit/Surveys/gov_reduce_income_inequality.json';

export default function TopicSurvey({next}) {

    return(
        <SurveyWrapper surveyJson={surveyJSON} next={next}/>
    )
}