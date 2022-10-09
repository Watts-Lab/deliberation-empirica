import {
  usePlayer,
  usePlayers,
  useRound,
  useStage,
} from "@empirica/core/player/classic/react";
import { Loading } from "@empirica/core/player/react";
import React, { useEffect } from "react";
import { Topic } from "../components/Topic";

export function TopicSurvey() {
  const round = useRound();
  const player = usePlayer();
  const players = usePlayers();
  const stage = useStage();
  const topic = round.get("topic");
  

  useEffect(() => {
    console.log(`Stage ${stage.get("index")}: Topic Survey`);
  }, []);

  const topicStyle = { padding: "40px" };

  if (player.stage.get("submit")) {
    if (players.length === 1) {
      return <Loading />;
    }

    return (
      <div className="text-center text-gray-400 pointer-events-none">
        Please wait for other player(s).
      </div>
    );
  }

  return (
    <div style={topicStyle}>
      <h2 className="text-md leading-6 font-medium text-gray-600">
        Please answer the following question with your personal opinion.
      </h2>
      <br />
      <Topic topic={topic} responseOwner={player} />
    </div>
  );
}
