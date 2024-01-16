/* eslint-disable default-case */
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

const cdnList = {
  // test: "deliberation-assets",
  test: "http://localhost:9091",
  local: "http://localhost:9090",
  prod: "https://s3.amazonaws.com/assets.deliberation-lab.org",
};

export function useFileURL({ file }) {
  const [filepath, setFilepath] = useState(undefined);
  const globals = useGlobal();
  const batchConfig = globals?.get("recruitingBatchConfig");
  // have to wait for globals to load, which is why we use the useEffects

  useEffect(() => {
    async function loadData() {
      const cdn = batchConfig?.cdn;
      const cdnURL = cdnList[cdn] || cdn || cdnList.prod;
      const fileURL = encodeURI(`${cdnURL}/${file}`);
      console.log(`Resolved filepath: ${fileURL}`);
      setFilepath(fileURL);
    }
    if (file && batchConfig) loadData();
  }, [file, batchConfig]);

  return filepath;
}

export function useText({ file }) {
  const [text, setText] = useState(undefined);
  const url = useFileURL({ file });

  useEffect(() => {
    async function loadData() {
      const { data } = await axios.get(url);
      setText(data);
    }
    if (url) loadData();
  }, [url]);
  return text;
}

export function usePermalink(file) {
  const globals = useGlobal();
  const resourceLookup = globals?.get("resourceLookup"); // get the permalink for this implementation of the file
  const permalink = resourceLookup ? resourceLookup[file] : undefined;
  return permalink;
}

const trimSlashes = (str) =>
  str
    .split("/")
    .filter((v) => v !== "")
    .join("/");

export function compare(lhs, comparator, rhs) {
  // uses chai assertion style

  switch (comparator) {
    case "exists":
      return lhs !== undefined;
    case "notExists":
      return lhs === undefined;
    case "equal":
      return lhs === rhs;
    case "notEqual":
      return lhs !== rhs;
  }

  if (!Number.isNaN(lhs) && !Number.isNaN(rhs)) {
    // check that lhs is a number
    // (types can go crazy here, as this works for strings containing numbers, like lhs="5")
    const numLhs = parseFloat(lhs);
    const numRhs = parseFloat(rhs);
    switch (comparator) {
      case "isAbove":
        return numLhs > numRhs;
      case "isBelow":
        return numLhs < numRhs;
      case "isAtLeast":
        return numLhs >= numRhs;
      case "isAtMost":
        return numLhs <= numRhs;
    }
  }

  if (typeof lhs === "string" && !Number.isNaN(rhs)) {
    switch (comparator) {
      case "lengthAtLeast":
        return lhs.length >= parseFloat(rhs);
      case "lengthAtMost":
        return lhs.length <= parseFloat(rhs);
    }
  }

  if (typeof lhs === "string" && typeof rhs === "string") {
    switch (comparator) {
      case "include":
        return lhs.includes(rhs);
      case "notInclude":
        return !lhs.includes(rhs);
      case "match":
        return !!lhs.match(new RegExp(trimSlashes(rhs)));
      case "notMatch":
        return !lhs.match(new RegExp(trimSlashes(rhs)));
    }
  }

  if (Array.isArray(rhs)) {
    switch (comparator) {
      case "oneOf":
        return Array.isArray(rhs) && rhs.includes(lhs); // check that rhs is an array
      case "notOneOf":
        return Array.isArray(rhs) && !rhs.includes(lhs); // check that rhs is an array
    }
  }

  console.error(
    `Invalid comparator: ${comparator} for lhs: ${lhs} and rhs: ${rhs}`
  );

  return undefined;
}
