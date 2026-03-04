import { useCallback, useRef, useState } from "react";

let nextBannerId = 0;

/**
 * Manage non-modal device fallback banners.
 *
 * Banners are informational UI notifications that auto-dismiss after a timeout.
 * They do NOT participate in error priority logic (that remains in useDeviceErrors
 * for permissions/in-use errors that require user action).
 *
 * @returns {{
 *   deviceBanners: Array<{ id: number, deviceType: string, message: string, variant: string }>,
 *   addDeviceBanner: Function,
 *   clearDeviceBanner: Function,
 *   clearBannersForDevice: Function,
 * }}
 */
export function useDeviceBanners() {
  const [banners, setBanners] = useState([]);
  const timerRefs = useRef(new Map());

  const clearDeviceBanner = useCallback((id) => {
    setBanners((prev) => prev.filter((b) => b.id !== id));
    const timer = timerRefs.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timerRefs.current.delete(id);
    }
  }, []);

  const clearBannersForDevice = useCallback((deviceType) => {
    setBanners((prev) => {
      const removed = prev.filter((b) => b.deviceType === deviceType);
      removed.forEach((b) => {
        const timer = timerRefs.current.get(b.id);
        if (timer) {
          clearTimeout(timer);
          timerRefs.current.delete(b.id);
        }
      });
      return prev.filter((b) => b.deviceType !== deviceType);
    });
  }, []);

  const addDeviceBanner = useCallback(
    ({ deviceType, message, variant = "warning", autoDismissMs = 10000 }) => {
      // Clear any existing banner for this device type first
      clearBannersForDevice(deviceType);

      nextBannerId += 1;
      const id = nextBannerId;
      const banner = { id, deviceType, message, variant };

      setBanners((prev) => [...prev, banner]);

      if (autoDismissMs > 0) {
        const timer = setTimeout(() => {
          clearDeviceBanner(id);
        }, autoDismissMs);
        timerRefs.current.set(id, timer);
      }

      return id;
    },
    [clearBannersForDevice, clearDeviceBanner]
  );

  return {
    deviceBanners: banners,
    addDeviceBanner,
    clearDeviceBanner,
    clearBannersForDevice,
  };
}
