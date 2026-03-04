import { useEffect } from "react";
import * as Sentry from "@sentry/react";

/**
 * Auto-recover when a disconnected device is plugged back in.
 *
 * When a device is unplugged, Daily fires a not-found error. If the user plugs
 * a device back in, the browser fires `devicechange`. This hook listens for
 * that event and auto-switches to the newly available device.
 *
 * @param {Object} callObject - Daily call object
 * @param {Object} devices - Daily useDevices() result (for setSpeaker)
 * @param {Object|null} deviceError - Current active device error
 * @param {Object} errorSetters - { setCameraError, setMicError, setSpeakerError }
 */
export function useDeviceRecovery(callObject, devices, deviceError, errorSetters) {
  const { setCameraError, setMicError, setSpeakerError } = errorSetters;

  useEffect(() => {
    if (!deviceError || !callObject || callObject.isDestroyed?.())
      return undefined;
    if (deviceError.dailyErrorType !== "not-found") return undefined;
    if (!navigator?.mediaDevices) return undefined;

    // Only handle known device error types to avoid mis-routing
    const isCamera = deviceError.type === "camera-error";
    const isMic = deviceError.type === "mic-error";
    const isSpeaker = deviceError.type === "speaker-error";
    if (!isCamera && !isMic && !isSpeaker) return undefined;

    const handleDeviceChange = async () => {
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const relevantDevices = allDevices.filter((d) => {
          if (isCamera) return d.kind === "videoinput";
          if (isSpeaker) return d.kind === "audiooutput";
          return d.kind === "audioinput";
        });

        if (relevantDevices.length > 0) {
          const device = relevantDevices[0];
          if (isCamera) {
            await callObject.setInputDevicesAsync({
              videoDeviceId: device.deviceId,
            });
            setCameraError(null);
          } else if (isSpeaker) {
            await devices.setSpeaker(device.deviceId);
            setSpeakerError(null);
          } else {
            await callObject.setInputDevicesAsync({
              audioDeviceId: device.deviceId,
            });
            setMicError(null);
          }
          // eslint-disable-next-line no-nested-ternary
          const deviceName = isCamera ? "camera" : isSpeaker ? "speaker" : "microphone";
          Sentry.addBreadcrumb({
            category: "device-recovery",
            message: `Device reconnected: auto-switched ${deviceName}`,
            level: "info",
          });
        }
      } catch (err) {
        console.warn(
          "[VideoCall] Device reconnection auto-recovery failed:",
          err
        );
      }
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange
      );
    };
  }, [deviceError, callObject, devices, setCameraError, setMicError, setSpeakerError]);
}
