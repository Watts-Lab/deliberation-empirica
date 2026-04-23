import { useEffect } from "react";
import * as Sentry from "@sentry/react";

/**
 * Listen for devicechange events when fallback banners are showing.
 *
 * When the alignment hook auto-falls-back to a default device (because the
 * preferred device was unplugged), a banner is shown. If the user plugs
 * the original device back in, the browser fires `devicechange`. This hook
 * checks whether the preferred device has returned and clears the banner —
 * the alignment effect will then re-run and switch back to the preferred device.
 *
 * @param {Object} player - Empirica player object (for reading preferred device IDs)
 * @param {Array} deviceBanners - Current array of device fallback banners
 * @param {Function} clearBannersForDevice - Clears banners for a given device type
 */
export function useDeviceRecovery(
  player,
  deviceBanners,
  clearBannersForDevice,
) {
  useEffect(() => {
    if (!deviceBanners || deviceBanners.length === 0) return undefined;
    if (!navigator?.mediaDevices) return undefined;

    const handleDeviceChange = async () => {
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();

        const kindMap = {
          camera: "videoinput",
          microphone: "audioinput",
          speaker: "audiooutput",
        };
        const prefKeyMap = {
          camera: "cameraId",
          microphone: "micId",
          speaker: "speakerId",
        };

        deviceBanners.forEach((banner) => {
          const prefId = player?.get(prefKeyMap[banner.deviceType]);
          const kind = kindMap[banner.deviceType];

          let found;
          if (prefId) {
            // Preferred device known — check if it specifically returned
            found = allDevices.some(
              (d) => d.kind === kind && d.deviceId === prefId,
            );
          } else {
            // No preferred device (Daily-event-path banner) — clear banner
            // when ANY device of matching type becomes available
            found = allDevices.some((d) => d.kind === kind);
          }

          if (found) {
            clearBannersForDevice(banner.deviceType);
            Sentry.addBreadcrumb({
              category: "device-recovery",
              message: `${prefId ? "Original" : "A"} ${banner.deviceType} ${prefId ? "reconnected" : "detected"}, clearing banner`,
              level: "info",
            });
          }
        });
      } catch (err) {
        console.warn("[VideoCall] devicechange banner check failed:", err);
      }
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange,
      );
    };
  }, [deviceBanners, player, clearBannersForDevice]);
}
