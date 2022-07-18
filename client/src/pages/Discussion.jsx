import React,  { useRef, useState, useEffect } from "react";
import { VideoCall } from "../components/VideoCall";
import Topic from "../components/Topic";
import { useGame, usePlayer, useRound, useStage } from "@empirica/player";

const invisibleStyle = {display: "none"};  

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
  minWidth:'50%',
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
  minWidth:'30%',
  //flexGrow:1
  //flexShrink:1
}

export default function Discussion(props) {
  const player = usePlayer();
  const round = useRound();
  const stage = useStage();
  const game = useGame();
  const accessKey = player.get("accessKey");
  console.log(`Discussion Access key: ${accessKey}`);

  const [videoCallEnabled, setVideoCallEnabled] = useState(window.Cypress ? false : true); //default hide in cypress test
  
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      console.log("Discussion ")
      console.log("Treatment:", game.treatment)
      return;
    }
  });

  useEffect(() => {
    console.log("Setting room name to player ID")
    if (videoCallEnabled) {
        player.set('roomName', round.id);
    }

    return () => {
        player.set('roomName', null) // done with this room, close it
    }
  }, [videoCallEnabled]);
  

  let handleClick = (event) => {
    player.stage.set("submit", true) // WHAT IS THIS SUPPOSED TO BE?
  }
  
  // setTimeout(() => {
  //   const hiding = document.getElementById('hiding');
  
  //   // 👇️ removes element from DOM
  //  hiding.style.display = 'none';
  //  setHasClicked(false);
  
  //   // 👇️ hides element (still takes up space on page)
  //   // box.style.visibility = 'hidden';
  // }, 1000); // 👈️ time in milliseconds
  

  return (
    <div style={containerStyle}>
      <div style={lowStyle}>
        <div style={vidStyle}>
          {videoCallEnabled && accessKey && <VideoCall 
              accessKey={accessKey}
              record={true}
              position={'relative'}  //TODO: move styling out of VideoCall into the parent component
              left={'0px'} 
              right={'10px'}
              height={'500px'}
              width={'60%'} 
          /> }
        </div>
        <div style={rStyle}>
          <h2 className="text-lg leading-6 font-medium text-gray-900">Please answer the following survey question as a group. </h2>
          <h2 className="text-lg leading-6 font-medium text-gray-900">This is a shared question and the selected answer will update when anyone clicks. </h2>
          <Topic topic={round.get("topic")} responseOwner={stage} submitButton={false} onChange={handleClick} whoClicked={player.get("name")}/>
          
          <input type="submit" data-test="skip" id="stageSubmitButton" onClick={() => next()} style={invisibleStyle}></input>  
          <input type="checkbox" data-test="enableVideoCall" id="videoCallEnableCheckbox" onClick={ e => setVideoCallEnabled(e.target.checked) } style={invisibleStyle}></input>
            
        </div>
      </div>
    </div>
  );
}
