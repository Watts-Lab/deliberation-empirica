import React from "react";
import { VideoCall } from "../components/VideoCall";
import Topic from "../components/Topic";
import { useState } from "react";
import { useGame } from "@empirica/player";
import DiscussionSurvey from "../intro-exit/Surveys/gov_reduce_income_inequality";

export default function Discussion(props) {
  const {player, round} = props;
  const invisibleStyle = {display: "none"};  
  const game = useGame();
  console.log(game.treatment);

  const [iframeEnabled, setIframeEnabled] = React.useState(window.Cypress ? false : true); //default hide in cypress test

  return (
    <div className="flex flex-col items-center top:5px space-y-5">
      <div>
        <Topic topic={round.get("topic")}/>

        <input type="checkbox" data-test="enableIframe" id="enableIframeCB" onClick={(cb)=>setIframeEnabled(cb.checked)} style={invisibleStyle}></input>
        <input type="submit" data-test="skip" style={invisibleStyle} onClick={() => player.stage.set("submit", true)}></input>
      </div>

      {iframeEnabled && 
        <div className="grid grid-col-3">
          <div className="col-span-2">
            <VideoCall 
              playerName={player.get("name")}
              roomName={round.id}  
              disableRemoteVideoMenu = {game.treatment.disableRemoteVideoMenu}
              disableRemoteMute = {game.treatment.disableRemoteMute}
              disableKick = {game.treatment.disableKick}
            />
          
          </div>
          <div>
            <DiscussionSurvey className="max-w-md"/>
          </div>
        </div>
      }

    </div>
  );
}
