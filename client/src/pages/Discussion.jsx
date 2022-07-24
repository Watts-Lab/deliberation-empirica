import React,  { useRef, useState, useEffect } from "react";
import { VideoCall } from "../components/VideoCall";
import { useGame, usePlayer, useRound, useStage } from "@empirica/player";

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

export default function Discussion({ prompt }) {
  const player = usePlayer();
  const round = useRound();
  const accessKey = player.get("accessKey");
  console.log(`Discussion Access key: ${accessKey}`);

  const [videoCallEnabled, setVideoCallEnabled] = useState(process.env.NODE_ENV === "production"); //default hide in cypress test

  useEffect(() => {
    console.log("Stage: Discussion")
  }, []);

  useEffect(() => {
    // the following code works around https://github.com/empiricaly/empirica/issues/132
    // TODO: remove when empirica is updated
    if (!accessKey && videoCallEnabled) {
        const timer = setTimeout(() => {
            console.log("Refreshing to load video")
            window.location.reload()
        }, 2000)
        return () => clearTimeout(timer);
    }
});

  useEffect(() => {
    if (videoCallEnabled) {
      console.log("Setting room name to round ID")
      player.set('roomName', round.id);
    } //else {
    //   player.set('roomName', null) // done with this room, close it
    // }

    return () => {
      player.set('roomName', null) // done with this room, close it
    }
  }, [videoCallEnabled]);
  

  return (
    <div style={containerStyle}>
      <div style={lowStyle}>
        <div style={vidStyle}>
          { videoCallEnabled && accessKey && <VideoCall 
              accessKey={accessKey}
              record={true}
          /> }
          {! accessKey && videoCallEnabled && <h2> Loading meeting room... </h2>}
          {! videoCallEnabled && <h2> Videocall Disabled for testing </h2>}
        </div>
        <div style={rStyle}>
          {prompt}
          { process.env.NODE_ENV === "development" && <input type="submit" data-test="skip" id="stageSubmitButton" onClick={() => player.stage.set("submit", true)} />}
          { process.env.NODE_ENV === "development" && <input type="checkbox" data-test="enableVideoCall" id="videoCallEnableCheckbox" onClick={ e => setVideoCallEnabled(e.target.checked) } />}
                
        </div>
      </div>
    </div>
  );
}
