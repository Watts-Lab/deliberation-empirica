import React, { useEffect } from "react";
import SurveyWrapper from "../../components/SurveyWrapper";
import scoreFunc from "./team_viability.score.js"; // TODO: load from surveys repo
import {useGame } from "@empirica/player"; 

export default function team_viability({ next }) {
    const game = useGame()

    useEffect(() => {
        console.log("Exit: TV Survey");
    }, [])

    return(
        <SurveyWrapper surveyJson={game.get("TVSurvey")} scoreFunc={scoreFunc} next={next} />
    )
}