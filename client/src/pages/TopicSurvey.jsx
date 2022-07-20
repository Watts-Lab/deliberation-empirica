import React, { useEffect } from "react";
import Topic from "../components/Topic";
import {useRound, usePlayer } from "@empirica/player";

export default function TopicSurvey() {
    const round = useRound();
    const player = usePlayer();
    const topic = round.get("topic");

    useEffect(() => {
      console.log("Stage: Topic Survey")
    }, []);
    

    if (player.stage.get("submit")) {
        if (players.length === 1) {
          return (
            <div className="text-center text-gray-400 pointer-events-none">
               Loading.
            </div>
          );
        }
    
        return (
          <div className="text-center text-gray-400 pointer-events-none">
            Please wait for other player(s).
          </div>
        );
    }

    return(
        <div>
            <h2 className="text-lg leading-6 font-medium text-gray-900">What is your personal opinion on the following topic?</h2>
            <br/>
            <Topic topic={topic} responseOwner={player}/>
        </div>
        
    )
}