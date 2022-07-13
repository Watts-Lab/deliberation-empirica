import React, { useState } from "react";
import SurveyWrapper from "../../components/SurveyWrapper";
import surveyJSON from './team_viability.json';
import scoreFunc from "./team_viability.score.js";
import {useGame } from "@empirica/player";

export default function team_viability({ next }) {
    const game = useGame()

    return(
        <SurveyWrapper surveyJson={game.get("TVSurvey")} scoreFunc={scoreFunc} next={next} />
    )
}