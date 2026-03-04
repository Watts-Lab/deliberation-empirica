import { useCallback, useEffect, useRef } from "react";
import * as Sentry from "@sentry/react";
import { findMatchingDevice } from "../utils/deviceAlignment";

/**
 * Align Daily devices with Empirica player preferences and handle device switching.
 *
 * Reads preferred device IDs/labels from player state (set during intro setup)
 * and aligns the Daily call's active devices to match. Uses a 3-tier fallback
 * strategy: exact ID match → label match (Safari ID rotation) → first available.
 *
 * When the preferred device is not found, sets an error with a picker UI so the
 * user can select an alternative.
 *
 * @param {Object} callObject - Daily call object
 * @param {Object} devices - Daily useDevices() result
 * @param {Object} player - Empirica player object
 * @param {Object} errorSetters - { setCameraError, setMicError, setSpeakerError }
 * @param {Object} gestureHandlers - { handleSetupFailure,
 *   setPendingGestureOperations, setPendingOperationDetails }
 * @param {Object} errorValues - { cameraError, micError, speakerError } for storm-guard reset
 * @returns {{ handleSwitchDevice: Function }}
 */
export function useDeviceAlignment(
  callObject,
  devices,
  player,
  errorSetters,
  gestureHandlers,
  errorValues
) {
  const { setCameraError, setMicError, setSpeakerError } = errorSetters;
  const {
    handleSetupFailure, setPendingGestureOperations, setPendingOperationDetails,
  } = gestureHandlers;
  const { cameraError, micError, speakerError } = errorValues;

  const preferredCameraId = player?.get("cameraId") ?? "waiting";
  const preferredMicId = player?.get("micId") ?? "waiting";
  const preferredSpeakerId = player?.get("speakerId") ?? "waiting";
  const preferredCameraLabel = player?.get("cameraLabel") ?? null;
  const preferredMicLabel = player?.get("micLabel") ?? null;
  const preferredSpeakerLabel = player?.get("speakerLabel") ?? null;

  const updatingCameraRef = useRef(false);
  const updatingMicRef = useRef(false);
  const updatingSpeakerRef = useRef(false);
  // Track devices we've already logged as unavailable to prevent log spam
  const loggedUnavailableCameraRef = useRef(null);
  const loggedUnavailableMicRef = useRef(null);
  const loggedUnavailableSpeakerRef = useRef(null);

  // Reset each storm-guard ref when its corresponding error clears so that a
  // future disconnect of the newly selected device can surface the error again.
  useEffect(() => {
    if (!cameraError) loggedUnavailableCameraRef.current = null;
  }, [cameraError]);
  useEffect(() => {
    if (!micError) loggedUnavailableMicRef.current = null;
  }, [micError]);
  useEffect(() => {
    if (!speakerError) loggedUnavailableSpeakerRef.current = null;
  }, [speakerError]);

  // ------------------- switch device from picker ---------------------
  const handleSwitchDevice = useCallback(
    async (deviceType, deviceId) => {
      if (!callObject || callObject.isDestroyed?.()) return;
      try {
        if (deviceType === "camera") {
          await callObject.setInputDevicesAsync({ videoDeviceId: deviceId });
          player?.set("cameraId", deviceId);
          loggedUnavailableCameraRef.current = null;
        } else if (deviceType === "microphone") {
          await callObject.setInputDevicesAsync({ audioDeviceId: deviceId });
          player?.set("micId", deviceId);
          loggedUnavailableMicRef.current = null;
        } else if (deviceType === "speaker") {
          await devices.setSpeaker(deviceId);
          player?.set("speakerId", deviceId);
          // Also save the label so future Safari ID-rotation fallback works
          const selectedSpeaker = devices?.speakers?.find(
            (s) => s.device.deviceId === deviceId
          );
          if (selectedSpeaker) {
            player?.set("speakerLabel", selectedSpeaker.device.label);
          }
          loggedUnavailableSpeakerRef.current = null;
        }
        // Clear only the error for the device that was just switched
        if (deviceType === "camera") setCameraError(null);
        else if (deviceType === "microphone") setMicError(null);
        else if (deviceType === "speaker") setSpeakerError(null);
      } catch (err) {
        console.warn("[VideoCall] Failed to switch device:", err);
        // If Safari requires a gesture for setSinkId, surface the gesture prompt
        if (
          deviceType === "speaker" &&
          (err?.name === "NotAllowedError" ||
            err?.message?.includes("user gesture"))
        ) {
          handleSetupFailure("speaker", err, {
            speakerId: deviceId,
            speakerLabel: devices?.speakers?.find(
              (s) => s.device.deviceId === deviceId
            )?.device?.label,
          });
        }
      }
    },
    [callObject, player, devices, handleSetupFailure, setCameraError, setMicError, setSpeakerError]
  );

  // ------------------- alignment effect ---------------------
  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.()) return;

    const camerasLoaded = devices?.cameras && devices.cameras.length > 0;
    const microphonesLoaded = devices?.microphones && devices.microphones.length > 0;
    const speakersLoaded = devices?.speakers && devices.speakers.length > 0;

    // Generic alignment function for camera and microphone (input devices)
    const alignInputDevice = async ({
      deviceType,
      deviceList,
      currentDeviceId,
      preferredId,
      preferredLabel,
      loggedUnavailableRef,
      updatingRef,
      setError,
      inputDeviceKey, // 'videoDeviceId' or 'audioDeviceId'
      errorType, // 'camera-error' or 'mic-error'
      deviceLabel, // e.g. 'Camera' or 'Microphone'
    }) => {
      const result = findMatchingDevice(deviceList, preferredId, preferredLabel);
      if (!result) return;

      const { device: targetDevice, matchType } = result;
      const targetId = targetDevice.device.deviceId;

      // Preferred device not found — show picker BEFORE the "already using" check.
      if (matchType === "fallback" && preferredId) {
        if (loggedUnavailableRef.current === preferredId) return;
        // eslint-disable-next-line no-param-reassign
        loggedUnavailableRef.current = preferredId;
        Sentry.captureMessage(`Preferred ${deviceType} not found, showing picker`, {
          level: "warning",
          tags: { deviceType, matchType: "fallback" },
          extra: {
            preferred: { id: preferredId, label: preferredLabel },
            availableDevices: deviceList?.map((d) => ({
              id: d.device.deviceId,
              label: d.device.label,
            })),
          },
        });
        setError({
          type: errorType,
          message: `Preferred ${deviceType} "${preferredLabel || preferredId}" not found`,
          dailyErrorType: "not-found",
          dailyEvent: null,
          pickerDevices: (deviceList ?? []).map((d, idx) => ({
            label: d.device.label || `${deviceLabel} ${idx + 1}`,
            deviceId: d.device.deviceId,
          })),
        });
        return;
      }

      // Skip if we're already using this device
      if (currentDeviceId === targetId) return;

      Sentry.addBreadcrumb({
        category: "device-alignment",
        message: `${deviceLabel} aligned via ${matchType} match`,
        level: "info",
        data: {
          deviceType, matchType, preferredId, preferredLabel,
          actualId: targetId, actualLabel: targetDevice.device.label,
        },
      });

      console.log(`Setting ${deviceType} via ${matchType} match`, {
        preferredId, preferredLabel, targetId, targetLabel: targetDevice.device.label, matchType,
      });
      // eslint-disable-next-line no-param-reassign
      loggedUnavailableRef.current = null;
      // eslint-disable-next-line no-param-reassign
      updatingRef.current = true;
      try {
        if (!callObject.isDestroyed?.()) {
          await callObject.setInputDevicesAsync({ [inputDeviceKey]: targetId });
          setError((prev) => (prev?.dailyErrorType === "not-found" ? null : prev));
        }
      } catch (err) {
        console.error(`Failed to set ${deviceType} via ${matchType} match`, err);
        if (deviceList?.[0]) {
          const fallbackId = deviceList[0].device.deviceId;
          console.log(`Retrying with fallback ${deviceType}`, {
            fallbackId, fallbackLabel: deviceList[0].device.label,
          });
          try {
            if (!callObject.isDestroyed?.()) {
              await callObject.setInputDevicesAsync({ [inputDeviceKey]: fallbackId });
            }
          } catch (fallbackErr) {
            console.error(`Fallback ${deviceType} also failed`, fallbackErr);
          }
        }
      } finally {
        // eslint-disable-next-line no-param-reassign
        updatingRef.current = false;
      }
    };

    // Speaker alignment is slightly different — uses devices.setSpeaker() and has gesture handling
    const alignSpeaker = async () => {
      const result = findMatchingDevice(
        devices?.speakers, preferredSpeakerId, preferredSpeakerLabel
      );
      if (!result) return;

      const { device: targetSpeaker, matchType } = result;
      const targetId = targetSpeaker.device.deviceId;

      if (matchType === "fallback" && preferredSpeakerId) {
        if (loggedUnavailableSpeakerRef.current === preferredSpeakerId) return;
        loggedUnavailableSpeakerRef.current = preferredSpeakerId;
        Sentry.captureMessage("Preferred speaker not found, showing picker", {
          level: "warning",
          tags: { deviceType: "speaker", matchType: "fallback" },
          extra: {
            preferred: { id: preferredSpeakerId, label: preferredSpeakerLabel },
            availableDevices: devices?.speakers?.map((s) => ({
              id: s.device.deviceId, label: s.device.label,
            })),
          },
        });
        setSpeakerError({
          type: "speaker-error",
          message: `Preferred speaker "${preferredSpeakerLabel || preferredSpeakerId}" not found`,
          dailyErrorType: "not-found",
          dailyEvent: null,
          pickerDevices: (devices?.speakers ?? []).map((s, idx) => ({
            label: s.device.label || `Speaker ${idx + 1}`,
            deviceId: s.device.deviceId,
          })),
        });
        return;
      }

      if (devices?.currentSpeaker?.device?.deviceId === targetId) return;

      Sentry.addBreadcrumb({
        category: "device-alignment",
        message: `Speaker aligned via ${matchType} match`,
        level: "info",
        data: {
          deviceType: "speaker", matchType,
          preferredId: preferredSpeakerId,
          preferredLabel: preferredSpeakerLabel,
          actualId: targetId,
          actualLabel: targetSpeaker.device.label,
        },
      });

      console.log(`Setting speaker via ${matchType} match`, {
        preferredSpeakerId, preferredSpeakerLabel,
        targetId, targetLabel: targetSpeaker.device.label, matchType,
      });
      loggedUnavailableSpeakerRef.current = null;
      updatingSpeakerRef.current = true;
      try {
        if (!callObject.isDestroyed?.()) {
          await devices.setSpeaker(targetId);
          setSpeakerError((prev) => (prev?.dailyErrorType === "not-found" ? null : prev));
          setPendingGestureOperations((prev) => ({ ...prev, speaker: false }));
          setPendingOperationDetails((prev) => ({ ...prev, speaker: null }));
        }
      } catch (err) {
        console.error(`Failed to set speaker via ${matchType} match`, err);

        if (err?.name === "NotAllowedError" || err?.message?.includes("user gesture")) {
          handleSetupFailure("speaker", err, {
            speakerId: targetId,
            speakerLabel: targetSpeaker.device.label,
          });
        } else if (matchType !== "fallback" && devices?.speakers?.[0]) {
          const fallbackId = devices.speakers[0].device.deviceId;
          console.log("Retrying with fallback speaker", {
            fallbackId, fallbackLabel: devices.speakers[0].device.label,
          });
          try {
            await devices.setSpeaker(fallbackId);
            setPendingGestureOperations((prev) => ({ ...prev, speaker: false }));
            setPendingOperationDetails((prev) => ({ ...prev, speaker: null }));
          } catch (fallbackErr) {
            console.error("Fallback speaker also failed", fallbackErr);
            if (
              fallbackErr?.name === "NotAllowedError"
              || fallbackErr?.message?.includes("user gesture")
            ) {
              handleSetupFailure("speaker", fallbackErr, {
                speakerId: fallbackId,
                speakerLabel: devices.speakers[0].device.label,
              });
            }
          }
        }
      } finally {
        updatingSpeakerRef.current = false;
      }
    };

    if (
      camerasLoaded &&
      preferredCameraId !== "waiting" &&
      updatingCameraRef.current === false &&
      devices?.currentCam?.device?.deviceId !== preferredCameraId
    ) {
      alignInputDevice({
        deviceType: "camera",
        deviceList: devices?.cameras,
        currentDeviceId: devices?.currentCam?.device?.deviceId,
        preferredId: preferredCameraId,
        preferredLabel: preferredCameraLabel,
        loggedUnavailableRef: loggedUnavailableCameraRef,
        updatingRef: updatingCameraRef,
        setError: setCameraError,
        inputDeviceKey: "videoDeviceId",
        errorType: "camera-error",
        deviceLabel: "Camera",
      });
    }

    if (
      microphonesLoaded &&
      preferredMicId !== "waiting" &&
      updatingMicRef.current === false &&
      devices?.currentMic?.device?.deviceId !== preferredMicId
    ) {
      alignInputDevice({
        deviceType: "microphone",
        deviceList: devices?.microphones,
        currentDeviceId: devices?.currentMic?.device?.deviceId,
        preferredId: preferredMicId,
        preferredLabel: preferredMicLabel,
        loggedUnavailableRef: loggedUnavailableMicRef,
        updatingRef: updatingMicRef,
        setError: setMicError,
        inputDeviceKey: "audioDeviceId",
        errorType: "mic-error",
        deviceLabel: "Microphone",
      });
    }

    if (
      speakersLoaded &&
      preferredSpeakerId !== "waiting" &&
      updatingSpeakerRef.current === false &&
      devices?.currentSpeaker?.device?.deviceId !== preferredSpeakerId
    ) {
      alignSpeaker();
    }
  }, [
    callObject,
    devices,
    preferredCameraId,
    preferredMicId,
    preferredSpeakerId,
    preferredCameraLabel,
    preferredMicLabel,
    preferredSpeakerLabel,
    devices?.currentCam?.device?.deviceId,
    devices?.currentMic?.device?.deviceId,
    devices?.currentSpeaker?.device?.deviceId,
    handleSetupFailure,
    setCameraError,
    setMicError,
    setSpeakerError,
    setPendingGestureOperations,
    setPendingOperationDetails,
  ]);

  return { handleSwitchDevice };
}
