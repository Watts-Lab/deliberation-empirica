/**
 * Client-side browser / OS detection hooks.
 *
 * Separated from `hooks.js` (which handles CDN-file loading and connection
 * info) since these are a distinct concern — UA sniffing for compatibility
 * gating and platform-specific prompts.
 *
 * Both hooks prefer the User-Agent Client Hints API where available and fall
 * back to the UA string.
 */

import { useState, useEffect } from "react";

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
