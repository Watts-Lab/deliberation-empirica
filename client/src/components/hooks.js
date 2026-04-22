import { useGlobal } from "@empirica/core/player/react";
import axios from "axios";
import { useState, useEffect } from "react";
import { resolveCdnBaseURL } from "./stagebookAdapterHelpers";

// Loads a file path referenced from `batchConfig` (e.g. `debrief`,
// `consentAddendum`, `customIdInstructions`). Those paths are stored as
// CDN-root-absolute (e.g. "projects/example/debrief.md"), not treatment-file
// relative, so we do NOT reuse stagebook's `resolveAssetURL` here — only the
// shared CDN base-URL lookup.
export function useFileURL({ file }) {
  const [filepath, setFilepath] = useState(undefined);
  const globals = useGlobal();
  const batchConfig = globals?.get("recruitingBatchConfig");
  const cdnList = globals?.get("cdnList");

  useEffect(() => {
    if (!file || !batchConfig || !cdnList) return;
    const cdnURL = resolveCdnBaseURL({ batchConfig, cdnList });
    if (!cdnURL) return;
    const fileURL = encodeURI(`${cdnURL}/${file}`);
    console.log(`Resolved filepath: ${fileURL}`);
    setFilepath(fileURL);
  }, [file, batchConfig, cdnList]);

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
          console.log(`Retrying connection info (country/VPN check)... (${retryCount}/${maxRetries})`);
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

