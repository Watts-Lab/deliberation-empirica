import React from "react";
import { VideoCall } from "../components/VideoCall";
import Topic from "../components/Topic";

export default function Discussion(props) {
  const player = props.player;
  const round = props.round;

  function handleSubmit() {
    player.stage.set("submit", true);
  }


  return (
    <div className="md:min-w-100 md:min-h-160 lg:min-w-200 xl:min-w-400 flex flex-col items-center top:5px space-y-5">
      <Topic topic={round.get("topic")}/>
      <VideoCall 
      playerName={"Nickname Goes Here?"}
      roomName={round.id} 
      position={'absolute'} 
      left={'10%'} 
      right ={'10%'}
      height = {'80%'}
      width = {'80%'} />
    </div>
  );
}
