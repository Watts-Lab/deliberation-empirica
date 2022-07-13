import React, { useState } from "react";
import SurveyWrapper from "../../components/SurveyWrapper";
import surveyJSON from './team_viability.json';
import scoreFunc from "./team_viability.score.js";
import {usePlayer, useGame } from "@empirica/player";

export default function team_viability({ next }) {
    const player = usePlayer();
    const game = useGame()
    console.log("Tv" + game.get("TVSurvey"))

    return(
        <SurveyWrapper surveyJson={game.get("TVSurvey")} scoreFunc={scoreFunc} next={next} />
    )
}