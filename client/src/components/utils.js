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

export function resolveResourcePath(path, tree) {
  if (!path) return undefined;
  console.log("tree", tree);

  // cant use hooks inside this sort of function, generally
  // const globals = useGlobal();
  // todo: move this to the batch object, instead of globals, once we get useBatch
  // const tree = globals?.get("resourceTree");

  const matches = tree.filter((element) => element.path === path);
  if (matches.length !== 1) {
    console.log(`could not find file path ${path} in GH repo`);
    return undefined;
  }
  const URL = matches[0].url || undefined;
  console.log(`resolve ${path} to ${URL}`);
  return URL;
}

export async function loadResource(URL) {
  if (!URL) return undefined;
  const { data } = await axios.get(URL);
  const { content } = data;
  const stringContent = atob(content); // is this ok? or is atob deprecation a problem?
  return stringContent;
}
