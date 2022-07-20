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

  const containerStyle = {
    display:'flex',
    //height:'100%',
    padding:'20px',
    height:'100%'
  }
  const lowStyle = {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: '100%',
    height: '100%'
  }

  const vidStyle = {
    padding:'15px',
    minWidth:'500px',
    //height:'100%',
   //height:'1000px',
    position:'relative',
    //size:'relative',
    // left={'0%'},
    // right ={'20%'},
    // height = {'500px'},
    width:'100%',
    //height:'500px'
  }

  const rStyle = {
    display:'flex',
    flexDirection:'column',
    padding:'35px',
    minWidth:'300px',
    width:'30%'
    //flexGrow:1
    //flexShrink:1
  }

  //


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
    <div style={containerStyle}>
      <div style={lowStyle}>
        <div style={vidStyle}>
          {iframeEnabled && <VideoCall 
          playerName={player.get("nickname")}
          roomName={round.id} 
          //position={'relative'} 
          // size={'relative'}
          // left={'0%'} 
          // right ={'20%'}
          height = {'630px'}
          // width = {'100%'} 
          disableRemoteVideoMenu = {game.treatment.disableRemoteVideoMenu}
          disableRemoteMute = {game.treatment.disableRemoteMute}
          disableKick = {game.treatment.disableKick}
          />
          }
        </div>
        <div style={rStyle}>
          <h2 className="text-md leading-6 text-gray-500">Please answer the following question as a group. </h2>
          <h3 className="text-sm leading-6 text-gray-500">(This is a shared question and the selected answer will update when anyone clicks.) </h3>
          <Topic topic={round.get("topic")} responseOwner={stage} submitButton={false}/>
          <input type="checkbox" data-test="enableIframe" id="enableIframeCB" onClick={(cb)=>setIframeEnabled(cb.checked)} style={invisibleStyle}></input>
          <input type="submit" data-test="skip" style={invisibleStyle} onClick={() => player.stage.set("submit", true)}></input>
        </div>
      </div>



    </div>
  );
}
