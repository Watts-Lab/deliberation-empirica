import React, { useRef, useEffect } from "react";
import { VideoCall } from "../components/VideoCall";
import Topic from "../components/Topic";
import { useState } from "react";
import { useGame, usePlayer, useRound, useStage } from "@empirica/player";

export default function Discussion(props) {
  const firstRender = useRef(true);

    useEffect(() => {
      if (firstRender.current) {
        firstRender.current = false;
        console.log("Discussion ")
        return;
      }
    });
  const player = usePlayer();
  const round = useRound();
  const stage = useStage();
  const invisibleStyle = {display: "none"};  
  const game = useGame();
  console.log(game.treatment)

  const [iframeEnabled, setIframeEnabled] = React.useState(window.Cypress ? false : true); //default hide in cypress test

  return (
    <div className="md:min-w-100 md:min-h-160 lg:min-w-200 xl:min-w-400 flex top:5px space-y-5">
      <div className="md:min-w-100 md:min-h-160 lg:min-w-200 xl:min-w-400 flex flex-col top:5px space-y-5">
      <h2 className="text-lg leading-6 font-medium text-gray-900">Please answer the following survey question as a group. </h2>
      <h2 className="text-lg leading-6 font-medium text-gray-900">This is a shared question and the selected answer will update when anyone clicks. </h2>
      <Topic topic={round.get("topic")} responseOwner={stage} submitButton={false}/>

      <input type="checkbox" data-test="enableIframe" id="enableIframeCB" onClick={(cb)=>setIframeEnabled(cb.checked)} style={invisibleStyle}></input>
      <input type="submit" data-test="skip" style={invisibleStyle} onClick={() => player.stage.set("submit", true)}></input>

      </div>

      {iframeEnabled && <VideoCall 
        playerName={player.get("name")}
        roomName={round.id} 
        position={'absolute'} 
        left={'0%'} 
        right ={'50%'}
        height = {'100%'}
        width = {'50%'} 
        disableRemoteVideoMenu = {game.treatment.disableRemoteVideoMenu}
        disableRemoteMute = {game.treatment.disableRemoteMute}
        disableKick = {game.treatment.disableKick}
      />
      }
    </div>
  );
}
