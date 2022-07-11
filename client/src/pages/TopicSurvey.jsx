import React from "react";
import Topic from "../components/Topic";
import {useRound } from "@empirica/player";

export default function TopicSurvey() {
    const round = useRound();
    return(
        <div>
            <h2>What is your personal opinion on the following topic?</h2>
            <Topic topic={round.get("topic")}/>
        </div>
        
    )
}