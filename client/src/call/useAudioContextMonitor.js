import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Monitor AudioContext state and provide controls to resume suspended audio.
 *
 * Safari and other browsers may suspend AudioContext due to autoplay policies.
 * This hook:
 * - Creates and monitors a shared AudioContext instance
 * - Detects when AudioContext is suspended
 * - Provides a method to resume audio (requires user gesture)
 * - Automatically attempts resume on user interaction
 *
 * @returns {Object} Audio context state and controls
 */
export function useAudioContextMonitor() {
  const [audioContextState, setAudioContextState] = useState("unknown");
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false);
  const audioContextRef = useRef(null);
  const lastGestureIdRef = useRef(0);
  const lastAttemptedGestureIdRef = useRef(0);

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

    console.log("[Audio] AudioContext created, initial state:", ctx.state);
    setAudioContextState(ctx.state);

    // If suspended on creation, we'll need user interaction
    if (ctx.state === "suspended") {
      setNeedsUserInteraction(true);
      console.warn("[Audio] AudioContext is suspended - user interaction required");
    }

    // Monitor state changes
    const handleStateChange = () => {
      console.log("[Audio] AudioContext state changed:", ctx.state);
      setAudioContextState(ctx.state);

      if (ctx.state === "suspended") {
        setNeedsUserInteraction(true);
      } else if (ctx.state === "running") {
        setNeedsUserInteraction(false);
      } else if (ctx.state === "closed") {
        setNeedsUserInteraction(false);
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
        console.log("[Audio] Detected suspended AudioContext, attempting auto-resume");

        // Try to resume (will silently fail if not in user gesture context)
        ctx.resume()
          .then(() => {
            console.log("[Audio] AudioContext auto-resumed successfully");
          })
          .catch((err) => {
            console.log("[Audio] Could not auto-resume (user gesture required):", err.message);
          });
    }, 5000); // Check every 5 seconds

    return () => clearInterval(checkInterval);
  }, []);

  // Manual resume function (call from user interaction)
  const resumeAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      console.warn("[Audio] No AudioContext to resume");
      return Promise.resolve();
    }

    if (audioContextRef.current.state === "closed") {
      console.warn("[Audio] AudioContext is closed and cannot be resumed");
      setNeedsUserInteraction(false);
      return Promise.resolve();
    }

    if (audioContextRef.current.state === "suspended") {
      console.log("[Audio] Attempting to resume AudioContext from user interaction");
      return audioContextRef.current.resume()
        .then(() => {
          console.log("[Audio] AudioContext resumed successfully");
          setNeedsUserInteraction(false);
        })
        .catch((err) => {
          console.error("[Audio] Failed to resume AudioContext:", err);
          throw err;
        });
    }

    console.log("[Audio] AudioContext already running");
    setNeedsUserInteraction(false);
    return Promise.resolve();
  }, []);

  return {
    audioContextState,
    needsUserInteraction,
    resumeAudioContext,
    audioContext: audioContextRef.current,
  };
}
