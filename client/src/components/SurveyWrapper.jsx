import React, { useCallback } from "react";
import { Survey, StylesManager, Model } from 'survey-react';
import 'survey-react/modern.min.css';
import fs from 'fs';
import { useGame, usePlayer } from "@empirica/player";

StylesManager.applyTheme("modern");

export default function SurveyWrapper({ surveyJson }) {
    const game = useGame()
    const player = usePlayer();
    const surveyModel = new Model(surveyJson);

    const saveResults = useCallback( sender => {
        const { data } = sender;
        data['playerId'] = player.id;
        data['gameNumber'] = game.index;
        localStorage.setItem(`${game.createdAt}/${player.id}`, JSON.stringify(data));
        console.log(data);
    });

    surveyModel.onComplete.add(saveResults);

    return(
        <Survey model={surveyModel} />
    )
}