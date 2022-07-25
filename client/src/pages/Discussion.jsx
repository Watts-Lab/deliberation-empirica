import React,  { useRef, useState, useEffect } from "react";
import { VideoCall } from "../components/VideoCall";
import { Button } from "../components/Button";
import { useGame, usePlayer, useRound, isDevelopment } from "@empirica/player";

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

  const urlParams = new URLSearchParams(window.location.search);
  const videoCallEnabledInDev = urlParams.get("videoCall") || false;

  useEffect(() => {
    console.log("Stage: Discussion")
    if (!isDevelopment || videoCallEnabledInDev) {
        console.log("Setting room name to player ID")
        player.set('roomName', player.id);
    }

    { isDevelopment && console.log(`Video Call Enabled: ${videoCallEnabledInDev}`) }

    return () => {
        player.set('roomName', null) // done with this room, close it
        player.set('accessKey', null) // is this covered in callbacks?
    }
}, []);

  useEffect(() => {
    // the following code works around https://github.com/empiricaly/empirica/issues/132
    // TODO: remove when empirica is updated
    if (!accessKey && (!isDevelopment || videoCallEnabledInDev)) {
        const timer = setTimeout(() => {
            console.log("Refreshing to load video")
            window.location.reload()
        }, 2000)
        return () => clearTimeout(timer);
    }
}); 

  return (
    <div style={containerStyle}>
      <div style={lowStyle}>
        <div style={vidStyle}>
          { ! accessKey && <h2 data-test="loadingVideoCall"> Loading meeting room... </h2>}
          { isDevelopment && ! videoCallEnabledInDev && <h2> Videocall Disabled for testing. To enable, add URL parameter "\&videoCall=true" </h2> }

          { accessKey && <VideoCall 
              accessKey={accessKey}
              record={true}
          /> }
        </div>
        <div style={rStyle}>
          {prompt}
          { isDevelopment && <input type="submit" data-test="skip" id="stageSubmitButton" onClick={() => player.stage.set("submit", true)} /> }
        </div>
      </div>
    </div>
  );
}
