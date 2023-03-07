import {
  usePlayer,
  useStage,
  useGame,
} from "@empirica/core/player/classic/react";
import { useGlobal } from "@empirica/core/player/react";
import axios from "axios";
import { useState, useEffect } from "react";

export function useProgressLabel() {
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

export function getFileURL(file) {
  const rawURL = `https://deliberation-assets.nyc3.cdn.digitaloceanspaces.com/${file}`;
  return encodeURI(rawURL);
}

export function useText(file) {
  const [text, setText] = useState(undefined);

  useEffect(() => {
    async function loadData() {
      if (process.env.NODE_ENV === "development") {
        fetch(`deliberation-assets/${file}`)
          .then((response) => response.text())
          .then((responseText) => {
            setText(responseText);
          });
      } else {
        const cdnURL = getFileURL(file);
        const { data } = await axios.get(cdnURL);
        setText(data);
      }
    }
    if (file) loadData();
  }, [file]);

  return text;
}

export function usePermalink(file) {
  const [permalink, setPermalink] = useState(undefined);
  const globals = useGlobal();

  useEffect(() => {
    const resourceLookup = globals?.get("resourceLookup"); // get the permalink for this implementation of the file
    if (resourceLookup && resourceLookup[file] !== permalink)
      setPermalink(resourceLookup[file]);
  }, [globals]);

  return permalink;
}

// export function useRemoteFileString(file) {
//   const globals = useGlobal();
//   const resourceLookup = globals?.get("resourceLookup"); // get the permalink for this implementation of the file
//   const fileURL = resourceLookup ? resourceLookup[`topics/${file}`] : undefined;
//   const [fileString, setFileString] = useState(undefined);

//   useEffect(() => {
//     async function loadData() {
//       const { data } = await axios.get(fileURL);
//       const { content } = data;
//       setFileString(atob(content));
//     }
//     if (fileURL) loadData();
//   }, [fileURL]);

//   console.log("file", file);
//   console.log("resourceLookup", resourceLookup);
//   console.log("fileURL", fileURL);
//   console.log("fileString", fileString);

//   return fileString;
// }

// export async function loadStringFromURL(URL) {
//   if (!URL) return undefined;
//   const { data } = await axios.get(URL);
//   const { content } = data;
//   const stringContent = atob(content); // is this ok? or is atob deprecation a problem?
//   return stringContent;
// }
