import React, { useState } from "react";
import ReactPlayer from "react-player";
import { useGame, usePlayer, useStage } from "@empirica/player";

const invisibleStyle = {display: "none"};  

const containerStyle = {
  display:'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  width: '100%'
}

const titleStyle = {
  paddingTop: '20px',
  display: 'flex',
  justifyContent: 'center',
  width: '100%'
}

const vidStyle = {
  padding:'15px',
  minHeight: '600px',
  height: '100%',
  maxHeight: '1000px',
  minWidth:'600px',
  width:'100%',
  maxWidth:'1000px'
}

export default function TrainingVideo(props) {
  const game = useGame();
  const player = usePlayer();
  const stage = useStage();
  
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  const handleReady = () => {
    const delay = setTimeout(() => setPlaying(true), 2000)
    return () => clearTimeout(delay)
  }

  const handleDuration = duration => {
    console.log(`Video Duration: ${duration}s`);
    stage.setTimer(new Date(), duration);
  }

  const handleEnded = () => {
    const delay = setTimeout(() => player.stage.set('submit', true), 1000)
    return () => clearTimeout(delay)
  }

  return (
    <div style={containerStyle}>
      <div style={titleStyle}>
        <h2 className="text-md leading-6 text-gray-500">
          Please take a moment to watch the following training video
        </h2>
        <input type="submit" data-test="skip" style={invisibleStyle} onClick={() => player.stage.set("submit", true)}></input>
      </div>
      <div style={vidStyle}>
        <ReactPlayer
          width='100%'
          height='100%'
          url={game.treatment.trainingVideoURL}
          playing={playing}
          volume={volume}
          muted={muted}
          onReady={handleReady}
          onDuration={handleDuration}
          onEnded={handleEnded}
        />
      </div>
    </div>
  );
}
