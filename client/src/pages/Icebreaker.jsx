import React, { useState, useEffect, useRef } from "react";
import { VideoCall } from "../components/VideoCall";
import { usePlayer, useRound } from "@empirica/player";

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

const invisibleStyle = {display: "none"}; 

export default function Icebreaker() {
  const player = usePlayer();
  const round = useRound();

  const [videoCallEnabled, setVideoCallEnabled] = useState(window.Cypress ? false : true); //default hide in cypress test

  // Questions based loosely on: 
  // Balietti, Stefano, Lise Getoor, Daniel G. Goldstein, and Duncan J. Watts. 2021. 
  // “Reducing Opinion Polarization: Effects of Exposure to Similar People with Differing Political Views.” 
  // Proceedings of the National Academy of Sciences of the United States of America 
  // 118 (52). https://doi.org/10.1073/pnas.2112552118.

  const firstRender = useRef(true);
  useEffect(() => {
      if (firstRender.current) {
          firstRender.current = false;
          console.log("Video Check")
      }

      // the following code works around https://github.com/empiricaly/empirica/issues/132
      // TODO: remove when empirica is updated
      if (! accessKey) {
          const timer = setTimeout(() => {
              console.log("Refreshing to load video")
              window.location.reload()
          }, 3000)
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
          <h2 className="text-lg leading-7 font-medium text-gray-1000">
            Please identify several non-obvious things you have in common with others in your group. 
          </h2>
          <p>For example:</p>
          <ul>
            <li>- your favorite color</li>
            <li>- places you have lived or visited</li>
            <li>- what sports you play or enjoy watching</li>
            <li>- what genre of books or movies you enjoy</li>
            <li>- how many siblings or children you have</li>
            <li>- etc...</li>
          </ul>
          <input type="submit" data-test="skip" style={invisibleStyle} onClick={() => player.stage.set("submit", true)}></input>
          <input type="checkbox" data-test="enableVideoCall" id="videoCallEnableCheckbox" onClick={ e => setVideoCallEnabled(e.target.checked) } style={invisibleStyle}></input>
         </div>
      </div>
    </div>
  );
}
