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

  if (!player) {
    return "unknown";
  }

  if (!player.get("introDone")) {
    const introStep = player.get("intro");
    return `intro_${introStep}`;
  }

  if (!game || !stage) {
    return "unknown_postIntro";
  }

  if (!game.get("ended")) {
    const stageIndex = stage.get("index");
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

export function useIpInfo() {
  const [country, setCountry] = useState(undefined);
  const [timezone, setTimezone] = useState(undefined);
  const [isKnownVpn, setIsKnownVpn] = useState(undefined);

  useEffect(() => {
    async function loadData() {
      const { data, status, statusText } = await axios.get("https://ipwho.is");
      if (status !== 200) {
        console.error(
          `Failed to get IP location, status ${status}: ${statusText}`
        );
        return;
      }
      const response = await axios.get(
        "https://raw.githubusercontent.com/X4BNet/lists_vpn/main/output/vpn/ipv4.txt"
      );
      const rawVpnList = response.data.split("\n");
      const vpnList = rawVpnList.map((line) => line.split("/")[0]);
      console.log(`Loaded ${vpnList.length} VPN/Datacenter ip addresses`);
      setIsKnownVpn(vpnList.includes(data.ip));
      setCountry(data.country_code);
      setTimezone(data.timezone.id);
    }

    loadData();
  }, []);

  return { country, timezone, isKnownVpn };
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
  switch (comparator) {
    case "exists":
      return lhs !== undefined;
    case "notExists":
    case "doesNotExist":
      return lhs === undefined;
    case "equal":
    case "equals":
      return lhs === rhs;
    case "notEqual":
    case "doesNotEqual":
      return lhs !== rhs;
  }

  if (lhs === undefined) {
    // sometimes the LHS is undefined, such as when the player has not typed
    // anything into a text entry field. In this case, we should return a falsy value
    // returning undefined signals that it isn't just that the comparison
    // returned a falsy value, but that the comparison could not yet be made
    return undefined;
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
      case "hasLengthAtLeast":
        return lhs.length >= parseFloat(rhs);
      case "lengthAtMost":
      case "hasLengthAtMost":
        return lhs.length <= parseFloat(rhs);
    }
  }

  if (typeof lhs === "string" && typeof rhs === "string") {
    switch (comparator) {
      case "include":
      case "includes":
        return lhs.includes(rhs);
      case "notInclude":
      case "doesNotInclude":
        return !lhs.includes(rhs);
      case "match":
      case "matches":
        return !!lhs.match(new RegExp(trimSlashes(rhs)));
      case "notMatch":
      case "doesNotMatch":
        return !lhs.match(new RegExp(trimSlashes(rhs)));
    }
  }

  if (Array.isArray(rhs)) {
    switch (comparator) {
      case "oneOf":
      case "isOneOf":
        return Array.isArray(rhs) && rhs.includes(lhs); // check that rhs is an array
      case "notOneOf":
      case "isNotOneOf":
        return Array.isArray(rhs) && !rhs.includes(lhs); // check that rhs is an array
    }
  }

  console.error(
    `Invalid comparator: ${comparator} for lhs: ${lhs} and rhs: ${rhs}`
  );

  return undefined;
}
