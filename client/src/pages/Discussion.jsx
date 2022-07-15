import React from "react";
import { VideoCall } from "../components/VideoCall";
import Topic from "../components/Topic";
import { useState } from "react";
import { useGame, usePlayer, useRound, useStage } from "@empirica/player";
import { useEffect } from "react";

export default function Discussion(props) {
  const player = usePlayer();
  const round = useRound();
  const stage = useStage();
  const invisibleStyle = {display: "none"};  
  const game = useGame();

  const [hasClicked, setHasClicked] = useState(false);
  //setClicked("true");

  const response = stage.get("topicResponse")

  console.log(game.treatment)

  useEffect(() => {
    //alert("answer changed");
    setHasClicked(true)
  }, [response]);

  let handleButtonClick = (cb) => {
    setIframeEnabled(cb.checked);
    
  }

  let handleClick = (event) => {
    player.stage.set("submit", true)
  }
  
  // setTimeout(() => {
  //   const hiding = document.getElementById('hiding');
  
  //   // 👇️ removes element from DOM
  //  hiding.style.display = 'none';
  //  setHasClicked(false);
  
  //   // 👇️ hides element (still takes up space on page)
  //   // box.style.visibility = 'hidden';
  // }, 1000); // 👈️ time in milliseconds
  

  const [iframeEnabled, setIframeEnabled] = React.useState(window.Cypress ? false : true); //default hide in cypress test

  return (
    <div className="md:min-w-100 md:min-h-160 lg:min-w-200 xl:min-w-400 flex flex-col items-center top:5px space-y-5">
      <h2 className="text-lg leading-6 font-medium text-gray-900">Please answer the following survey question as a group:</h2>
      
      
      <Topic topic={round.get("topic")} responseOwner={stage} submitButton={false} onChange={handleClick}/>

      <input type="checkbox" data-test="enableIframe" id="enableIframeCB" onClick={handleButtonClick} style={invisibleStyle}></input>
      {/* submit button just for testing */}
      {/* hasClicked && <h3 id="hiding" className="text-sm text-gray-500">Someone changed the selected answer</h3> */}
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
