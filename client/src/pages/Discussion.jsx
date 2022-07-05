import React from "react";
import { VideoCall } from "../components/VideoCall";
import Topic from "../components/Topic";
import { useState } from "react";
import { useGame } from "@empirica/player";
// import ExampleTopic from "../components/ExampleTopic"

export default function Discussion(props) {
  const {player, round} = props;
  const invisibleStyle = {display: "none"};  
  const game = useGame();
  console.log(game.treatment)

  const [iframeEnabled, setIframeEnabled] = React.useState(window.Cypress ? false : true); //default hide in cypress test

  return (
    <div className="md:min-w-100 md:min-h-160 lg:min-w-200 xl:min-w-400 flex flex-col items-center top:5px space-y-5">
      <Topic topic={round.get("topic")}/>

      <input type="checkbox" data-test="enableIframe" id="enableIframeCB" onClick={(cb)=>setIframeEnabled(cb.checked)} style={invisibleStyle}></input>
      <input type="submit" data-test="skip" style={invisibleStyle} onClick={() => player.stage.set("submit", true)}></input>

      {iframeEnabled && <VideoCall 
        playerName={player.get("name")}
        roomName={round.id} 
        position={'absolute'} 
        left={'0%'} 
        right ={'5%'}
        height = {'100%'}
        width = {'100%'} 
        disableRemoteVideoMenu = {game.treatment.disableRemoteVideoMenu}
        disableRemoteMute = {game.treatment.disableRemoteMute}
        disableKick = {game.treatment.disableKick}
      />
      }
    </div>
  );
}
