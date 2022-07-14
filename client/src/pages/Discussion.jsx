import React, { useRef, useEffect } from "react";
import { VideoCall } from "../components/VideoCall";
import Topic from "../components/Topic";
import { useState } from "react";
import { useGame, usePlayer, useRound, useStage } from "@empirica/player";
import { findByLabelText } from "@storybook/testing-library";

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

  const containerStyle = {
    display:'flex',
    height:'700px'
  }
  const lowStyle = {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start'
  }

  const vidStyle = {
    padding:'15px',
    minWidth:'860px',
    //minHeight:'1000px',
    position:'relative',
    size:'relative',
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
    minWidth:'400px',
    //flexGrow:1
    //flexShrink:1
  }

  //

  const [iframeEnabled, setIframeEnabled] = React.useState(window.Cypress ? false : true); //default hide in cypress test

  return (
    <div style={containerStyle}>
      <div style={lowStyle}>
        <div style={vidStyle}>
          {iframeEnabled && <VideoCall 
          playerName={player.get("name")}
          roomName={round.id} 
          //position={'relative'} 
          // size={'relative'}
          // left={'0%'} 
          // right ={'20%'}
          height = {'600px'}
          // width = {'100%'} 
          disableRemoteVideoMenu = {game.treatment.disableRemoteVideoMenu}
          disableRemoteMute = {game.treatment.disableRemoteMute}
          disableKick = {game.treatment.disableKick}
          />
          }
        </div>
        <div style={rStyle}>
          <h2 className="text-lg leading-6 font-medium text-gray-900">Please answer the following survey question as a group. </h2>
          <h2 className="text-lg leading-6 font-medium text-gray-900">This is a shared question and the selected answer will update when anyone clicks. </h2>
          <Topic topic={round.get("topic")} responseOwner={stage} submitButton={false}/>
          <input type="checkbox" data-test="enableIframe" id="enableIframeCB" onClick={(cb)=>setIframeEnabled(cb.checked)} style={invisibleStyle}></input>
          <input type="submit" data-test="skip" style={invisibleStyle} onClick={() => player.stage.set("submit", true)}></input>
        </div>
      </div>



    </div>
  );
}
