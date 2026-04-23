import { useEffect } from "react";
import * as Sentry from "@sentry/react";

/**
 * Monitor browser camera/mic permissions during the call.
 *
 * Users can revoke permissions mid-call (accidentally or intentionally), and
 * browsers can auto-revoke permissions for inactive tabs. This hook detects
 * revocations immediately and routes them through the unified device error
 * path so the same UserMediaError UI (with PermissionDeniedGuidance) is shown
 * regardless of whether the denial was detected by the Permissions API or by
 * Daily's camera-error/mic-error event.
 *
 * @param {Function} setCameraError - Setter for camera error state
 * @param {Function} setMicError - Setter for mic error state
 */
export function usePermissionMonitor(setCameraError, setMicError) {
  useEffect(() => {
    if (!navigator.permissions) return undefined;

    let camPerm = null;
    let micPerm = null;

    const monitorPermissions = async () => {
      try {
        [camPerm, micPerm] = await Promise.all([
          navigator.permissions.query({ name: "camera" }),
          navigator.permissions.query({ name: "microphone" }),
        ]);

        const handlePermChange = (type, permObj) => () => {
          console.warn(
            `[Permissions] ${type} permission changed to: ${permObj.state}`,
          );

          if (permObj.state === "denied") {
            console.error(
              `[Permissions] ${type} permission DENIED during call!`,
            );
            const setErr = type === "camera" ? setCameraError : setMicError;
            setErr({
              type: type === "camera" ? "camera-error" : "mic-error",
              message: `${type} permission revoked mid-call`,
              dailyErrorType: "permissions",
              dailyEvent: null, // No Daily event — detected via Permissions API
            });
            Sentry.addBreadcrumb({
              category: "permissions",
              message: `${type} permission revoked mid-call`,
              level: "warning",
            });
          }
          // Note: "granted" state change is handled by UserMediaError's
          // permission monitoring hook, which auto-reloads when permissions
          // flip from denied → granted.
        };

        camPerm.onchange = handlePermChange("camera", camPerm);
        micPerm.onchange = handlePermChange("microphone", micPerm);
      } catch (err) {
        console.warn("[Permissions] Cannot monitor permission changes:", err);
      }
    };

    monitorPermissions();

    return () => {
      // Clean up permission listeners to prevent memory leaks
      if (camPerm) camPerm.onchange = null;
      if (micPerm) micPerm.onchange = null;
    };
  }, [setCameraError, setMicError]);
}
