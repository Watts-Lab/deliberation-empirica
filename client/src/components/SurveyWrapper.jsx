import React, { useCallback } from "react";
import { Survey, StylesManager, Model } from 'survey-react';
import 'survey-react/modern.min.css';
import surveyStyle from "./SurveyWrapper.css";
import { useGame, usePlayer } from "@empirica/player";
import surveyTool from "..//intro-exit/Surveys/surveyTool"

StylesManager.applyTheme("modern");

export default function SurveyWrapper({ surveyJson, next }) {
    const game = useGame()
    const player = usePlayer();
    const surveyModel = new Model(surveyJson);

    const saveResults = useCallback( sender => {
        const { data } = sender;
        player.set('Surveys', data);
        if (Object.keys(data)[0] === "team-viability") {
            const result = surveyTool(game.treatment.topic, game.players.length, data)
            console.log(result)
        }
        next();
    });

    surveyModel.onComplete.add(saveResults);

    return(
        <Survey style={surveyStyle} model={surveyModel} />
    )
}