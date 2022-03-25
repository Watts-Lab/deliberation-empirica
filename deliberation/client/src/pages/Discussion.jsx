import { usePlayer } from "@empirica/player";
import React from "react";
import { VideoCall } from "../components/VideoCall";
import { Topic } from "../components/Topic";

export function Discussion() {
  const player = usePlayer();

  function handleSubmit() {
    player.stage.set("submit", true);
  }

  return (
    <div className="md:min-w-120 lg:min-w-200 xl:min-w-400 flex flex-col items-center space-y-10">
      <Topic/>
      <VideoCall playerName={"Test"}/>
    </div>
  );
}
