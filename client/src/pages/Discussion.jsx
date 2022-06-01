import React from "react";
import { VideoCall } from "../components/VideoCall";
import Topic from "../components/Topic";
import { useState } from "react";
import { useEffect } from "react";
import { Button } from "../components/Button";

export default function Discussion(props) {
  const player = props.player;
  const round = props.round;
  const [playerName, setPlayerName] = useState(""); 

  useEffect(() => {
    setPlayerName(document.getElementById("name").value);
  })

  function handleSubmit() {
    player.stage.set("submit", true);
  }

  function handleText(e) {
    setPlayerName(e.target.value);
  }
  function handleName() {
    setPlayerName(document.getElementById("name"));
    console.log(playerName);
  }


  return (
    <div className="md:min-w-100 md:min-h-160 lg:min-w-200 xl:min-w-400 flex flex-col items-center top:5px space-y-5">
      <h3> Please enter the name you'd like displayed to other participants below. </h3>
      <input id = "name" className = " px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-empirica-500 focus:border-empirica-500 sm:text-sm" type="textarea" onChange={handleText}></input>
      <Button handleClick={handleName} autoFocus>
        <p>Next</p>
      </Button>
      
      <Topic topic={round.get("topic")}/>
      <VideoCall playerName={playerName} roomName={round.id}/>
    </div>
  );
}
