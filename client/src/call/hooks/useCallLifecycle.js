import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Manage Daily room join/leave lifecycle and Firefox stall detection.
 *
 * ## Firefox Tab Blur Issue (Issue #1187)
 * Firefox suspends WebRTC API calls (including callObject.join()) when the tab
 * is unfocused. This causes the join to hang indefinitely if the user switches
 * tabs before the page finishes loading. When this happens, the user sees
 * "Waiting for participant to connect..." because the join never completes.
 *
 * Solution: Detect when the join is taking too long AND the tab was blurred,
 * then show an overlay prompting the user to click. The click:
 * 1. Focuses the page, allowing the stalled join() to complete
 * 2. Provides a user gesture for AudioContext.resume() if needed
 *
 * The overlay auto-dismisses when the join completes (which happens shortly
 * after the page regains focus).
 *
 * @param {Object} callObject - Daily call object
 * @param {string} roomUrl - Daily room URL from game state
 * @param {Object} player - Empirica player object (read once for position at join time)
 * @returns {{ joinStalled: boolean, clearJoinStalled: Function }}
 */
export function useCallLifecycle(callObject, roomUrl, player) {
  const joiningMeetingRef = useRef(false);
  const unmountedRef = useRef(false); // track unmount to handle orphaned joins (#1226)
  // For stall detection (issue #1187) - track if join is taking too long due to blur
  const joinStartTimeRef = useRef(null);
  const blurredDuringJoinRef = useRef(false);
  const [joinStalled, setJoinStalled] = useState(false);

  useEffect(() => {
    if (roomUrl) return undefined; // URL arrived — nothing to warn about
    // Delay the warning to avoid firing during the brief window between the game
    // starting and the server finishing the async createRoom() call.
    const timer = setTimeout(() => {
      console.warn(
        "[VideoCall] No Daily room URL after 5 s (game.get('dailyUrl') is still empty).",
        "In a test environment, check that DAILY_APIKEY is configured on the server.",
        "In production, the server may have failed to create the Daily room."
      );
    }, 5000);
    return () => clearTimeout(timer);
  }, [roomUrl]);

  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.() || !roomUrl) return undefined;
    // `roomUrl` is only populated when the batch config had checkVideo/checkAudio enabled.
    // When both flags are false we skip Daily entirely (handy for layout demos), so this
    // effect bails before trying to join a non-existent room.

    unmountedRef.current = false;

    // Track blur events during join to detect stalled joins
    // Track inline timeout IDs so cleanup can clear them on unmount
    const inlineTimers = [];
    const handleBlurDuringJoin = () => {
      if (joiningMeetingRef.current) {
        blurredDuringJoinRef.current = true;
        // If page blurs during join, show prompt after short delay (not 5s)
        inlineTimers.push(setTimeout(() => {
          if (joiningMeetingRef.current && blurredDuringJoinRef.current) {
            console.warn("[VideoCall] Join stalled - tab blurred during join");
            setJoinStalled(true);
          }
        }, 500));
      }
    };
    window.addEventListener("blur", handleBlurDuringJoin);

    // Fallback stall detection - if join takes > 5s and tab was blurred, prompt user
    const stallTimer = setTimeout(() => {
      if (joiningMeetingRef.current && blurredDuringJoinRef.current) {
        console.warn(
          "[VideoCall] Join appears stalled due to tab blur - prompting user"
        );
        setJoinStalled(true);
      }
    }, 5000);

    const joinRoom = async () => {
      // Debounce: wait briefly before joining to avoid spurious joins during
      // transient mounts. During stage transitions, Empirica can briefly render
      // a VideoCall component (~36ms) for a non-video stage before React
      // reconciliation unmounts it. Without this delay, the transient mount
      // calls join() while the previous stage's cleanup is mid-leave(),
      // corrupting the callObject state for subsequent video stages.
      // 150ms is imperceptible to users but longer than any observed transient
      // mount, and long enough for the previous leave() to complete.
      // See issue #1236.
      await new Promise((resolve) => {
        inlineTimers.push(setTimeout(resolve, 150));
      });
      if (unmountedRef.current) {
        console.log("[VideoCall] Join debounce: component unmounted during delay, skipping join");
        return;
      }

      const meetingState = callObject.meetingState?.();
      if (meetingState === "joined-meeting" || joiningMeetingRef.current) {
        console.warn("[VideoCall] joinRoom skipped — already in meeting or joining", {
          meetingState,
          joiningMeetingRef: joiningMeetingRef.current,
        });
        return;
      }

      const joinStartTime = Date.now();
      joinStartTimeRef.current = joinStartTime;
      // Check if page is ALREADY unfocused when join starts
      const alreadyUnfocused = !document.hasFocus();
      blurredDuringJoinRef.current = alreadyUnfocused;

      // If page is already unfocused, show prompt quickly (Firefox suspends WebRTC when unfocused)
      if (alreadyUnfocused) {
        inlineTimers.push(setTimeout(() => {
          if (joiningMeetingRef.current) {
            console.warn(
              "[VideoCall] Join stalled - page was unfocused at start"
            );
            setJoinStalled(true);
          }
        }, 500));
      }

      joiningMeetingRef.current = true;

      try {
        // Pass position in userData for immediate mapping by other participants
        // (avoids waiting for Empirica sync - see issue #1187)
        const position = player.get("position");
        await callObject.join({
          url: roomUrl,
          // Only include userData if position is defined (may be undefined if player hook hasn't resolved)
          userData: position != null ? { position } : undefined,
        });
        const joinDuration = Date.now() - joinStartTime;

        // Orphaned join detection (#1226): if the component unmounted while
        // join() was in flight, the cleanup couldn't call leave() because
        // meetingState was "joining". Now that join completed, leave immediately
        // so the callObject doesn't stay stuck in "joined-meeting" on a stale room.
        if (unmountedRef.current) {
          console.warn("[VideoCall] Orphaned join detected — leaving immediately", {
            roomUrl,
            durationMs: joinDuration,
          });
          callObject.leave();
          return;
        }

        // Join succeeded - clear stalled state
        setJoinStalled(false);
        blurredDuringJoinRef.current = false;
        console.log("[VideoCall] Joined Daily room", {
          roomUrl,
          durationMs: joinDuration,
          hasFocus: document.hasFocus(),
          visibilityState: document.visibilityState,
        });
        // Flag slow joins for debugging (likely caused by tab blur)
        if (joinDuration > 5000) {
          console.warn("[VideoCall] Slow join detected", {
            durationMs: joinDuration,
            possibleCause: "Tab may have lost focus during join",
          });
        }

        // INTENT: Disable autoGainControl to prevent quiet audio caused by AGC
        // re-adjusting after the intro steps mute/unmute cycle.
        //
        // STATUS: NOT WORKING — see https://github.com/Watts-Lab/deliberation-empirica/issues/1195
        //
        // What we tried:
        //
        // 1. setInputDevicesAsync({ audioSource: constraints }) — current code below.
        //    audioSource expects a MediaStreamTrack, not a constraints object.
        //    Daily warns "Received unexpected audioDeviceId" and silently no-ops.
        //    The constraints are never applied.
        //
        // 2. updateInputSettings({ audio: constraints }) — tried on branch fix/device-recovery-1190.
        //    updateInputSettings only accepts processor settings (noise-cancellation type),
        //    NOT raw MediaTrackConstraints. Throws: "inputSettings must be of the form:
        //    { audio?: { processor: { type: ['none'|'noise-cancellation'] } } }".
        //
        // Likely correct approach:
        //    const stream = await navigator.mediaDevices.getUserMedia({
        //      audio: { autoGainControl: false, echoCancellation: true, noiseSuppression: true }
        //    });
        //    await callObject.setInputDevicesAsync({ audioSource: stream.getAudioTracks()[0] });
        //    Requires managing track lifecycle and preventing Daily from reverting to default.
        //
        try {
          await callObject.setInputDevicesAsync({
            audioSource: {
              autoGainControl: false,
              echoCancellation: true,
              noiseSuppression: true,
            },
          });
          console.log(
            "Attempted AGC disable via setInputDevicesAsync (may be a no-op; see #1195)"
          );
        } catch (agcErr) {
          console.warn("Failed to attempt AGC disable:", agcErr);
        }
      } catch (err) {
        console.error("Error joining Daily room", roomUrl, err);
      } finally {
        joiningMeetingRef.current = false;
      }
    };

    joinRoom(); // in a function to allow async/await

    return () => {
      // cleanup on unmount or roomUrl change
      unmountedRef.current = true;
      clearTimeout(stallTimer);
      inlineTimers.forEach(clearTimeout);
      window.removeEventListener("blur", handleBlurDuringJoin);

      if (!callObject || callObject.isDestroyed?.()) return;
      const state = callObject.meetingState?.();

      if (
        // state === "joining" ||
        state === "joined-meeting" ||
        state === "loaded"
      ) {
        // only leave if we are in the process of joining or already joined
        console.log("Leaving Daily room");
        callObject.leave();
      } else if (state === "joining") {
        console.warn("[VideoCall] Cleanup: callObject is mid-join, leave() skipped", {
          state,
          roomUrl,
        });
      }
    };
    // `player` is intentionally excluded: position is read once at join time and
    // we must not re-run this effect (re-join the room) on every player state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callObject, roomUrl]);

  const clearJoinStalled = useCallback(() => {
    setJoinStalled(false);
    blurredDuringJoinRef.current = false;
  }, []);

  return { joinStalled, clearJoinStalled };
}
