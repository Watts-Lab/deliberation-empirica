import {
  usePlayer,
  useStage,
  useGame,
} from "@empirica/core/player/classic/react";
import axios from "axios";

export function getProgressLabel() {
  const player = usePlayer();
  const game = useGame();
  const stage = useStage();

  if (!player.get("introDone")) {
    const introStep = player.get("intro");
    return `intro_${introStep}`;
  }

  if (!game?.get("ended")) {
    const stageIndex = stage?.get("index");
    return `stage_${stageIndex}`;
  }

  const exitStep = player.get("exitStep");
  return `exit_${exitStep}`;
}

export async function loadResource(URL) {
  if (!URL) return undefined;
  const { data } = await axios.get(URL);
  const { content } = data;
  const stringContent = atob(content); // is this ok? or is atob deprecation a problem?
  return stringContent;
}
