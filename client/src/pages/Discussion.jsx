import { usePlayer, useRound } from "@empirica/player";
import React from "react";
import { VideoCall } from "../components/VideoCall";
import Topic from "../components/Topic";

export default function Discussion() {
  const player = usePlayer();
  const round = useRound();

  function handleSubmit() {
    player.stage.set("submit", true);
  }

  //TODO: change hard coded topic to the topic for the round 
  return (
    <div className="md:min-w-120 lg:min-w-200 xl:min-w-400 flex flex-col items-center space-y-5">
      <Topic topic="abortion"/>
      <VideoCall playerName={"Nickname Goes Here?"} roomName={round.id}/>
    </div>
  );
}
