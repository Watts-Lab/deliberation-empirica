import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Monitor AudioContext state and provide controls to resume suspended audio.
 *
 * ## Browser Autoplay Policies (Issue #1187)
 *
 * Modern browsers restrict audio/video autoplay to prevent unwanted media playback.
 * This affects WebRTC applications in several ways:
 *
 * ### Safari
 * - Suspends AudioContext until user gesture
 * - Requires explicit click to resume audio playback
 *
 * ### Firefox (most complex behavior)
 * - Suspends AudioContext when page lacks focus
 * - **Critical**: Firefox also suspends WebRTC API calls (`enumerateDevices`,
 *   `startCamera`, `callObject.join`) when the tab is unfocused
 * - If user clicks a link to open the app, then switches tabs before the page loads,
 *   the Daily.co join() call will hang indefinitely until the page regains focus
 * - Firefox may auto-resume AudioContext when page regains focus (unlike Safari)
 *
 * ### Solution
 * This hook detects when audio/video connections may be stalled due to focus issues:
 * - `needsUserInteraction`: AudioContext is suspended, needs gesture to resume
 * - `blurredWhileSuspended`: Page lost focus while AudioContext was suspended
 *   (Firefox-specific scenario where connections may be stalled)
 *
 * The overlay prompts the user to click, which:
 * 1. Provides the required user gesture for AudioContext.resume()
 * 2. Focuses the page, allowing stalled WebRTC calls to complete
 *
 * ### Auto-dismiss
 * When AudioContext transitions to "running" (e.g., when page regains focus),
 * all flags are automatically cleared to dismiss the overlay without requiring
 * an explicit button click.
 *
 * @returns {Object} Audio context state and controls
 * @returns {string} audioContextState - "unknown" | "suspended" | "running" | "closed"
 * @returns {boolean} needsUserInteraction - True if AudioContext is suspended
 * @returns {boolean} blurredWhileSuspended - True if page was unfocused while suspended
 * @returns {Function} resumeAudioContext - Call from click handler to resume audio
 * @returns {AudioContext} audioContext - The underlying AudioContext instance
 */
export function useAudioContextMonitor() {
  const [audioContextState, setAudioContextState] = useState("unknown");
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false);
  // Track if page was blurred while AudioContext was suspended - requires explicit click to clear
  const [blurredWhileSuspended, setBlurredWhileSuspended] = useState(false);
  const audioContextRef = useRef(null);
  const lastGestureIdRef = useRef(0);
  const lastAttemptedGestureIdRef = useRef(0);
  // Track when user has explicitly clicked to resume - prevents blur handler from re-triggering
  const userResumeInProgressRef = useRef(false);

  // Initialize AudioContext and monitor its state
  useEffect(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn("[Audio] AudioContext not supported in this browser");
      return undefined;
    }

    // Create a single shared AudioContext instance
    const ctx = new AudioContextClass();
    audioContextRef.current = ctx;

    setAudioContextState(ctx.state);

    // If suspended on creation, we'll need user interaction
    if (ctx.state === "suspended") {
      setNeedsUserInteraction(true);
      // If page is ALREADY unfocused when suspended, require explicit gesture (issue #1187)
      if (!document.hasFocus()) {
        setBlurredWhileSuspended(true);
        console.warn("[Audio] AudioContext suspended while page unfocused");
      } else {
        console.warn("[Audio] AudioContext suspended on creation");
      }
    }

    // Monitor state changes
    const handleStateChange = () => {
      setAudioContextState(ctx.state);

      if (ctx.state === "suspended") {
        setNeedsUserInteraction(true);
      } else if (ctx.state === "running") {
        // AudioContext is now running - clear all flags since audio is working
        // This can happen when page regains focus (Firefox auto-resumes on focus)
        setNeedsUserInteraction(false);
        setBlurredWhileSuspended(false);
      } else if (ctx.state === "closed") {
        setNeedsUserInteraction(false);
        setBlurredWhileSuspended(false);
      }
    };

    ctx.addEventListener("statechange", handleStateChange);

    // Cleanup
    return () => {
      ctx.removeEventListener("statechange", handleStateChange);
      ctx.close().catch(() => {});
      audioContextRef.current = null;
    };
  }, []);

  // Track blur events while AudioContext is suspended (issue #1187)
  // If page loses focus while suspended, require explicit click to clear
  useEffect(() => {
    const handleBlur = () => {
      // Skip if user has explicitly clicked to resume (prevents race condition)
      if (userResumeInProgressRef.current) return;
      const ctx = audioContextRef.current;
      if (ctx && ctx.state === "suspended") {
        console.warn("[Audio] Page blurred while AudioContext suspended");
        setBlurredWhileSuspended(true);
      }
    };

    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, []);

  // Track user gestures so we only retry auto-resume after a new gesture.
  useEffect(() => {
    const handleUserGesture = () => {
      lastGestureIdRef.current += 1;
    };

    document.addEventListener("pointerdown", handleUserGesture, {
      capture: true,
      passive: true,
    });
    document.addEventListener("keydown", handleUserGesture, {
      capture: true,
      passive: true,
    });

    return () => {
      document.removeEventListener("pointerdown", handleUserGesture, {
        capture: true,
      });
      document.removeEventListener("keydown", handleUserGesture, {
        capture: true,
      });
    };
  }, []);

  // Periodically check AudioContext state and attempt auto-resume
  useEffect(() => {
    if (!audioContextRef.current) return undefined;

    const checkInterval = setInterval(() => {
      const ctx = audioContextRef.current;
      if (!ctx) return;

      if (ctx.state === "closed") {
        clearInterval(checkInterval);
        return;
      }

      if (ctx.state !== "suspended") {
        return;
      }

      if (lastGestureIdRef.current <= lastAttemptedGestureIdRef.current) {
        return;
      }

      lastAttemptedGestureIdRef.current = lastGestureIdRef.current;

      // Try to resume (will silently fail if not in user gesture context)
      ctx.resume().catch(() => {
        // User gesture required - silent failure expected
      });
    }, 5000); // Check every 5 seconds

    return () => clearInterval(checkInterval);
  }, []);

  // Manual resume function (call from user interaction)
  const resumeAudioContext = useCallback(() => {
    // Mark that user has explicitly initiated a resume - prevents blur handler race condition
    userResumeInProgressRef.current = true;

    if (!audioContextRef.current) {
      userResumeInProgressRef.current = false;
      return Promise.resolve();
    }

    if (audioContextRef.current.state === "closed") {
      setNeedsUserInteraction(false);
      setBlurredWhileSuspended(false);
      userResumeInProgressRef.current = false;
      return Promise.resolve();
    }

    if (audioContextRef.current.state === "suspended") {
      // Clear flags IMMEDIATELY on user gesture - don't wait for async resume
      // The gesture context is valid now; waiting for the Promise can cause overlay flicker
      setNeedsUserInteraction(false);
      setBlurredWhileSuspended(false);
      return audioContextRef.current.resume()
        .then(() => {
          console.log("[Audio] AudioContext resumed successfully");
          userResumeInProgressRef.current = false;
        })
        .catch((err) => {
          console.error("[Audio] Failed to resume AudioContext:", err);
          // Restore flags if resume actually failed (shouldn't happen with valid gesture)
          setNeedsUserInteraction(true);
          userResumeInProgressRef.current = false;
          throw err;
        });
    }

    setNeedsUserInteraction(false);
    setBlurredWhileSuspended(false);
    userResumeInProgressRef.current = false;
    return Promise.resolve();
  }, []);

  return {
    audioContextState,
    needsUserInteraction,
    blurredWhileSuspended,
    resumeAudioContext,
    audioContext: audioContextRef.current,
  };
}
