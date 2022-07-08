import React, { useEffect, useState } from "react";
import { VideoCall } from "../components/VideoCall";
import Topic from "../components/Topic";
import { useGame, useStage } from "@empirica/player";

export default function Discussion(props) {
  const {player, round} = props;
  const invisibleStyle = {display: "none"};  
  const game = useGame();
  const stage = useStage();
  console.log(game.treatment)

  const [iframeEnabled, setIframeEnabled] = useState(window.Cypress ? false : true); //default hide in cypress test

  useEffect(() => {
    player.set('roomName', stage.id);
  }, []);

  return (
    <div className="md:min-w-100 md:min-h-160 lg:min-w-200 xl:min-w-400 flex flex-col items-center top:5px space-y-5">
      <Topic topic={round.get("topic")}/>

      <input type="checkbox" data-test="enableIframe" id="enableIframeCB" onClick={(cb)=>setIframeEnabled(cb.checked)} style={invisibleStyle}></input>
      <input type="submit" data-test="skip" style={invisibleStyle} onClick={() => player.stage.set("submit", true)}></input>

      {iframeEnabled && <VideoCall 
        roomName={stage.id}
        record={true}
        position={'absolute'} 
        left={'0%'} 
        right ={'5%'}
        height = {'100%'}
        width = {'100%'}
      />
      }
    </div>
  );
}
