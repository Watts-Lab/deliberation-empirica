import React,  { useRef, useState, useEffect } from "react";
import { VideoCall } from "../components/VideoCall";
import Topic from "../components/Topic";
import { useGame, usePlayer, useRound, useStage } from "@empirica/player";

const invisibleStyle = {display: "none"};  

const containerStyle = {
  display:'flex',
  padding: '20px',
  height:'700px'
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
  position:'relative',
  width:'100%',
}

const rStyle = {
  display:'flex',
  flexDirection:'column',
  padding:'35px',
  minWidth:'300px',
  width: '30%'
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
    }

    // the following code works around https://github.com/empiricaly/empirica/issues/132
    // TODO: remove when empirica is updated
    if (! accessKey) {
      const timer = setTimeout(() => window.location.reload(), 2000)
      return () => clearTimeout(timer);
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
          { accessKey && <VideoCall 
              accessKey={accessKey}
              record={true}
          /> }
          {! accessKey && <h2> Loading meeting room... </h2>}
        </div>
        <div style={rStyle}>
          <h3 className="text-md leading-6 font-medium text-gray-600">Please answer the following survey question as a group. This is a shared question and the selected answer will update when anyone clicks. </h3>
          <Topic topic={round.get("topic")} responseOwner={stage} submitButton={false} onChange={handleClick} whoClicked={player.get("name")}/>
          
          <input type="submit" data-test="skip" onClick={() => player.stage.set("submit", true)} style={invisibleStyle}></input>  
          <input type="checkbox" data-test="enableVideoCall" id="videoCallEnableCheckbox" onClick={ e => setVideoCallEnabled(e.target.checked) } style={invisibleStyle}></input>
            
        </div>
      </div>
    </div>
  );
}
