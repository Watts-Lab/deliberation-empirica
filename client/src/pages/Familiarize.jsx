import React from "react";
import { VideoCall } from "../components/VideoCall";
import Topic from "../components/Topic";
import { useState } from "react";
import { useGame, usePlayer, useRound, useStage } from "@empirica/player";
import { useEffect } from "react";

export default function Familiarize(props) {
  const player = usePlayer();
  const round = useRound();
  const stage = useStage();
  const invisibleStyle = {display: "none"};  
  const game = useGame();

  const containerStyle = {
    display:'flex',
    height:'100%',
    width:'100%'
  }
  const lowStyle = {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    //padding:'5%',
    //left:'30%'
  }

  const vidStyle = {
    padding:'15px',
    //minWidth:'100%',
    //minHeight:'1000px',
    position:'relative',
    //size:'relative',
    //left:'',
    // right ={'20%'},
    // height = {'500px'},
    width:'95%',
    //height:'100%',
    //minHeight:'600px',
    flexGrow: '4'
    //height:'500px'
  }

  const rStyle = {
    display:'flex',
    width:'30%',
    flexDirection:'column',
    padding:'4%',
    minWidth:'200px',
    flexGrow:1
    //flexShrink:1
  }

  //


  // let handleButtonClick = (cb) => {
  //   setIframeEnabled(cb.checked);
    
  // }

  // let handleClick = (event) => {
  //   player.stage.set("submit", true)
  // }
  
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
          height = {'610px'}
          // width = {'100%'} 
          disableRemoteVideoMenu = {game.treatment.disableRemoteVideoMenu}
          disableRemoteMute = {game.treatment.disableRemoteMute}
          disableKick = {game.treatment.disableKick}
          />
          }
        </div>
        <div style={rStyle}>
          <h2 className="text-lg leading-7 font-medium text-gray-1000">Please spend this time in your group finding something you all have in common. </h2>
          <input type="submit" data-test="skip" style={invisibleStyle} onClick={() => player.stage.set("submit", true)}></input>
         </div>
      </div>



    </div>
  );
}
