/* eslint-disable default-case */
import {
  usePlayer,
  useGame,
  usePlayers,
} from "@empirica/core/player/classic/react";
import { useGlobal } from "@empirica/core/player/react";
import axios from "axios";
import { useState, useEffect, useCallback, useRef } from "react";

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
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const url = useFileURL({ file });

  useEffect(() => {
    async function loadData() {
      try {
        const { data } = await axios.get(url);
        setText(data);
        setError(null); // Clear any previous errors
      } catch (err) {
        console.error("Error loading url:", url, err);
        setError(err);
        if (retryCount < 4) {
          // Retry up to 4 times
          setTimeout(() => setRetryCount(retryCount + 1), 1000); // Retry after 1 seconds
        }
      }
    }
    if (url) loadData();
  }, [url, retryCount]);

  return { text, error };
}

export function useConnectionInfo() {
  const [country, setCountry] = useState(undefined);
  const [timezone, setTimezone] = useState(undefined);
  const [timezoneOffset, setTimezoneOffset] = useState(undefined);
  const [isKnownVpn, setIsKnownVpn] = useState(undefined);

  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 3000; // 3 seconds

    async function loadData() {
      try {
        const ipwhois = await axios.get("https://ipwho.is");
        if (ipwhois.status !== 200) {
          throw new Error(
            `Failed to get IP location, status ${ipwhois.status}: ${ipwhois.statusText}`
          );
        }
        setCountry(ipwhois.data.country_code);
        setTimezone(ipwhois.data.timezone.id);
        setTimezoneOffset(ipwhois.data.timezone.utc);

        const vpnListResponse = await axios.get(
          "https://raw.githubusercontent.com/X4BNet/lists_vpn/main/output/vpn/ipv4.txt"
        );
        if (vpnListResponse.status !== 200) {
          throw new Error(
            `Failed to get VPN list, status ${vpnListResponse.status}: ${vpnListResponse.statusText}`
          );
        }
        const rawVpnList = vpnListResponse.data.split("\n");
        const vpnList = rawVpnList.map((line) => line.split("/")[0]);
        console.log(`Loaded ${vpnList.length} VPN/Datacenter ip addresses`);
        setIsKnownVpn(vpnList.includes(ipwhois.data.ip));
      } catch (error) {
        console.error(error.message);
        if (retryCount < maxRetries) {
          retryCount += 1;
          console.log(`Retrying... (${retryCount}/${maxRetries})`);
          setTimeout(loadData, retryDelay);
        }
      }
    }

    loadData();
  }, []);

  return { country, timezone, isKnownVpn, timezoneOffset };
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

function isNumberOrParsableNumber(value) {
  return (
    typeof value === "number" ||
    (typeof value === "string" &&
      value.trim() !== "" &&
      !Number.isNaN(Number(value)))
  );
}

export function compare(lhs, comparator, rhs) {
  switch (comparator) {
    case "exists":
      return lhs !== undefined;
    case "notExists":
    case "doesNotExist":
      return lhs === undefined;
  }

  if (lhs === undefined) {
    // sometimes the LHS is undefined, such as when the player has not typed
    // anything into a text entry field. In this case, we should return a falsy value
    // returning undefined signals that it isn't just that the comparison
    // returned a falsy value, but that the comparison could not yet be made
    if (comparator === "doesNotEqual") return true; // undefined is not equal to anything

    return undefined;
  }

  if (isNumberOrParsableNumber(lhs) && isNumberOrParsableNumber(rhs)) {
    // check that lhs is a number
    // (types can go crazy here, as this works for strings containing numbers, like lhs="5")
    const numLhs = parseFloat(lhs);
    const numRhs = parseFloat(rhs);
    switch (comparator) {
      case "equals":
        return numLhs === numRhs; // numeric match
      case "doesNotEqual":
        return numLhs !== numRhs;
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
      case "equals":
        return lhs === rhs; // string match
      case "doesNotEqual":
        return lhs !== rhs;
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

  if (typeof lhs === "boolean" && typeof rhs === "boolean") {
    switch (comparator) {
      case "equals":
        return lhs === rhs;
      case "doesNotEqual":
        return lhs !== rhs;
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

  console.error(`Invalid comparator: ${comparator} for lhs, rhs:`, lhs, rhs);

  return undefined;
}

const getNestedValueByPath = (obj, path) =>
  path.reduce((acc, key) => acc?.[key], obj);

export function useReferenceValues({ reference, position }) {
  // returns a list of values for the reference string
  // because there can be more than one if position is "all" or "percentAgreement"
  const player = usePlayer();
  const game = useGame();
  const players = usePlayers();

  const type = reference.split(".")[0]; // e.g. "survey", "submitButton", "qualtrics", "prompt", "urlParams", "connectionInfo", "browserInfo", "participantInfo"
  let name; // which survey, prompt, etc
  let path; // for surveys or things with multiple fields, which one to get
  let referenceKey;

  if (["survey", "submitButton", "qualtrics"].includes(type)) {
    [, name, ...path] = reference.split(".");
    referenceKey = `${type}_${name}`;
  } else if (type === "prompt") {
    // eslint-disable-next-line prefer-destructuring
    name = reference.split(".")[1];
    referenceKey = `${type}_${name}`;
    path = ["value"]; // shortcut for prompt value, so you don't have to include it in the reference string
  } else if (["urlParams", "connectionInfo", "browserInfo"].includes(type)) {
    [, ...path] = reference.split(".");
    referenceKey = type;
  } else if (["participantInfo", "discussion"].includes(type)) {
    // gets values saved directly on the player object
    [, name, ...path] = reference.split(".");
    referenceKey = name;
  } else {
    throw new Error(`Invalid reference type: ${type}`);
  }

  let referenceSource;
  switch (position) {
    case "shared":
      referenceSource = [game];
      break;
    case "player":
    case undefined:
      referenceSource = [player];
      break;
    case "all":
    case "any":
    case "percentAgreement":
      referenceSource = players;
      break;
    default:
      if (Number.isInteger(parseInt(position))) {
        referenceSource = players.filter(
          (p) => parseInt(p.get("position")) === position
        ); // array
      } else {
        throw new Error(`Invalid position value: ${position}`);
      }
  }

  let referenceValues;
  try {
    const referenceObjects = referenceSource.map((p) => p.get(referenceKey));
    referenceValues = referenceObjects.map((obj) =>
      getNestedValueByPath(obj, path)
    );
  } catch (e) {
    throw new Error(`Error getting reference value for ${reference}:`, e);
  }

  return referenceValues;
}

export function useGetBrowser() {
  const [browser, setBrowser] = useState("unknown");

  useEffect(() => {
    if (browser !== "unknown") return;

    const detect = () => {
      if (typeof navigator === "undefined") return "unknown";

      // Use the User-Agent Client Hints API if available
      const brands = navigator.userAgentData?.brands;
      if (Array.isArray(brands)) {
        if (brands.some(({ brand }) => brand.includes("Edg"))) return "Edge";
        if (brands.some(({ brand }) => brand.includes("Chromium")))
          return "Chrome";
        if (brands.some(({ brand }) => brand.includes("Firefox")))
          return "Firefox";
        if (brands.some(({ brand }) => brand.includes("Safari")))
          return "Safari";
        return "other";
      }

      // Fallback to userAgent string
      const ua = navigator.userAgent;
      if (!ua || typeof ua !== "string") return "unknown";
      if (/edg/i.test(ua)) return "Edge";
      if (/chrome/i.test(ua) && !/edg/i.test(ua)) return "Chrome";
      if (/firefox/i.test(ua)) return "Firefox";
      if (/safari/i.test(ua) && !/chrome/i.test(ua)) return "Safari";

      return "other";
    };

    setBrowser(detect());
  }, [browser]);

  return browser;
}

export function useGetOS() {
  const [os, setOS] = useState("unknown");

  useEffect(() => {
    if (os !== "unknown") return;

    const detectOS = () => {
      if (typeof navigator === "undefined") return "unknown";
      const ua = navigator.userAgent;

      if (/windows/i.test(ua)) return "Windows";
      if (/macintosh|mac os x/i.test(ua)) return "MacOS";
      if (/linux/i.test(ua)) return "Linux";
      if (/android/i.test(ua)) return "Android";
      if (/iphone|ipad|ipod/i.test(ua)) return "iOS";

      return "other";
    };

    setOS(detectOS());
  }, [os]);

  return os;
}

// Simple debounce hook
export function useDebounce(callback, delay) {
  const timeoutRef = useRef();
  
  return useCallback((...args) => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
}
