/* eslint-disable no-nested-ternary */
import React, {
  useState,
  useRef,
  useLayoutEffect,
  useMemo,
  useEffect,
} from "react";

import { usePlayer, usePlayers } from "@empirica/core/player/classic/react";
import { useDaily, useParticipantIds } from "@daily-co/daily-react";
import { defaultResponsiveLayout } from "./layouts/defaultResponsiveLayout";
import { computePixelsForLayout } from "./layouts/computePixelsForLayout";
import { Tile } from "./Tile";
import { useStageEventLogger } from "./hooks/eventLogger";

/**
 * Module-level ref for diagnostic access to desired subscription state.
 *
 * This allows FixAV error reporting to capture what subscriptions SHOULD be
 * (based on layout) vs what they actually are (from Daily API), without
 * adding React context complexity for a single diagnostic use case.
 *
 * The Map stores: dailyId → { audio: boolean, video: boolean, screenVideo: boolean }
 *
 * Why use a module-level ref instead of React context?
 * - Only one piece of diagnostic state needs sharing between components
 * - Avoids the overhead of creating a context provider/consumer
 * - Easy to refactor to context later if we need more shared state
 * - Simpler and more pragmatic for this specific debugging scenario
 */
export const latestDesiredSubscriptions = { current: new Map() };

/**
 * Module-level ref for diagnostic access to current room positions.
 *
 * This allows FixAV to identify which other participants are in the same room
 * when requesting cross-participant diagnostics, without adding React context.
 *
 * The array stores position strings for all participants in the current player's room.
 *
 * LIMITATION: This ref is shared across all Call component instances. In environments
 * where multiple Call components render simultaneously (e.g., Cypress tests, Storybook),
 * the last-rendered instance's room positions will overwrite previous values. This is
 * acceptable for production use where only one Call instance exists, but be aware of
 * this limitation in test environments.
 */
export const currentRoomPositions = { current: [] };

export function Call({ showSelfView = true, layout, rooms }) {
  // ------------------- measure container size ---------------------
  const containerRef = useRef(null);
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return () => {}; // do nothing

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    updateSize(); // measure immediately on mount

    const observer = new ResizeObserver(updateSize);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  // ------------------- compute layout ---------------------
  const players = usePlayers() ?? [];
  const player = usePlayer();
  const myPosition = player.get("position"); // comes as a string
  const logStageEvent = useStageEventLogger();

  // list all positions, sorted by the player.id to ensure stable order
  const allPositions = useMemo(
    () =>
      players
        .slice()
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map((p) => p.get("position")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players.length]
  ); // only recompute if players list length changes

  const myLayout = useMemo(() => {
    // if zero size, can't compute layout
    if (width === 0 || height === 0) return null;

    let workingLayout;
    if (layout && layout[myPosition]) {
      // if a layout is provided from the treatment file, use it
      workingLayout = layout;
    } else {
      // otherwise, compute a new layout

      // default to displaying all positions
      let positionsToDisplay = allPositions.slice();

      if (rooms) {
        // Find the room I am in.
        // We check that all positions that see a discussion are assigned to a room
        // in the zod validation, so this should always find a room.
        const myRoom = rooms.find((room) =>
          room.includePositions.some(
            (position) => String(position) === myPosition
          )
        );

        if (!myRoom) {
          // If the current player isn't mapped to a room, don't display any tiles
          positionsToDisplay = [];
        } else {
          // filter to only positions in my room (preserving order)
          positionsToDisplay = positionsToDisplay.filter((position) =>
            myRoom.includePositions.some((p) => String(p) === String(position))
          );
        }
      }

      // Store room positions for FixAV diagnostic requests (before filtering out self)
      currentRoomPositions.current = positionsToDisplay.slice();

      // filter out self if not showing
      if (!showSelfView) {
        positionsToDisplay = positionsToDisplay.filter(
          (position) => String(position) !== myPosition
        );
      }

      // warn if no positions to display
      if (positionsToDisplay.length === 0) {
        console.warn(
          "Player position",
          myPosition,
          "not viewing any tiles in:",
          rooms
        );
        return null; // nothing to render
      }

      // compute layout for included positions
      workingLayout = defaultResponsiveLayout({
        positions: positionsToDisplay,
        selfPosition: myPosition,
        width,
        height,
        tileAspectRatio: 16 / 9,
      });
    }

    // compute pixel positions for layout
    const hydratedLayout = computePixelsForLayout(
      workingLayout[myPosition] || workingLayout,
      width,
      height,
      16 / 9
    );

    return hydratedLayout;
  }, [width, height, layout, myPosition, allPositions, rooms, showSelfView]);

  // ------------------- update subscribed tracks ---------------------
  /**
   * Daily auto-subscribes to every remote track unless we opt out. Because we
   * render custom layouts and only want to pull media for the feeds on screen,
   * we manually toggle subscriptions based on the computed layout (see
   * https://docs.daily.co/guides/scaling-calls/best-practices-to-scale-large-experiences#track-subscriptions).
   */
  const callObject = useDaily();
  const dailyParticipantIds = useParticipantIds({ filter: "remote" });

  // Disable Daily's auto-subscribe behavior when we join the call,
  // as it doesn't work when we set up the callObject in App.jsx.
  useEffect(() => {
    if (!callObject) return () => {}; // do nothing

    const disableAutoSub = () => {
      try {
        callObject.setSubscribeToTracksAutomatically(false);
      } catch (error) {
        console.warn("Failed to disable automatic track subscription:", error);
      }
    };

    if (callObject.meetingState?.() === "joined-meeting") {
      disableAutoSub();
    }

    callObject.on("joined-meeting", disableAutoSub);

    return () => {
      callObject.off("joined-meeting", disableAutoSub);
    };
  }, [callObject]);

  const playersSubscriptionSignature = useMemo(
    () =>
      // Players can change frequently (new object references) even when the fields we care
      // about stay the same. We build a simple string signature that only includes the pieces
      // relevant to track subscriptions so we can quickly check if anything important changed.
      players
        .map((p) => {
          const dailyId = p.get("dailyId") ?? "";
          const position = p.get("position") ?? "";
          return `${p.id}:${dailyId}:${position}`;
        })
        .sort()
        .join("|"),
    [players]
  );

  const playersByDailyIdRef = useRef({
    signature: null,
    map: new Map(),
  });

  // Build a lookup table from Daily participant IDs to Empirica player positions.
  const playersByDailyId = useMemo(() => {
    // If the signature hasn't changed, reuse the cached map. This avoids rebuilding the
    // map on every render when nothing meaningful changed, which keeps the subscription
    // effect from firing needlessly.
    if (
      playersByDailyIdRef.current.signature === playersSubscriptionSignature
    ) {
      return playersByDailyIdRef.current.map;
    }
    const map = new Map();
    players.forEach((p) => {
      const pDailyId = p.get("dailyId");
      if (!pDailyId) return;
      map.set(pDailyId, p.get("position"));
    });
    playersByDailyIdRef.current = {
      signature: playersSubscriptionSignature,
      map,
    };
    return map;
  }, [playersSubscriptionSignature, players]);

  // Track when we last attempted a repair to avoid hammering the Daily API.
  // After a repair attempt, we wait before trying again to give Daily time to process.
  const lastRepairAttemptRef = useRef(0);
  const REPAIR_COOLDOWN_MS = 3000; // Wait 3 seconds after a repair before trying again

  // Track when we last logged subscription status (to avoid spam)
  const lastStatusLogRef = useRef(0);
  const STATUS_LOG_INTERVAL_MS = 10000; // Log status every 10 seconds max

  // Track last desired state to only log when it changes (avoid spam)
  const lastDesiredStateRef = useRef(null);

  // Track last blocked state per participant to only warn on state transitions
  const lastBlockedStateRef = useRef({});

  // Track last logged missing dailyIds to avoid log spam (issue #1187)
  const lastMissingDailyIdsRef = useRef("");

  // Force a re-check of subscriptions periodically to catch any silent failures
  // or network drops that didn't trigger a layout/participant change event.
  const [recheckCount, setRecheckCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRecheckCount((c) => c + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Trigger immediate subscription repair when page regains focus (issue #1187).
  // Firefox suspends WebRTC API calls when tab is unfocused, which can cause
  // subscriptions to get out of sync. When the user refocuses the page,
  // we immediately trigger a recheck instead of waiting for the next timer tick.
  useEffect(() => {
    const handleFocus = () => {
      console.log("[Subscription] Page focused - triggering immediate recheck");
      setRecheckCount((c) => c + 1);
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  // Trigger immediate subscription repair when join completes (issue #1187).
  // If the join was stalled due to Firefox tab blur, subscriptions may be out of sync
  // when the join finally completes. Trigger immediate recheck on "joined-meeting".
  useEffect(() => {
    if (!callObject) return undefined;

    const handleJoined = () => {
      console.log(
        "[Subscription] Joined meeting - triggering immediate recheck"
      );
      setRecheckCount((c) => c + 1);
    };

    callObject.on("joined-meeting", handleJoined);
    return () => callObject.off("joined-meeting", handleJoined);
  }, [callObject]);

  // Trigger immediate subscription repair when a new participant joins (issue #1187).
  // When a participant with a stalled Firefox join finally connects, OTHER participants
  // need to subscribe to them. The "participant-joined" event fires on all clients
  // when someone new joins, so we use this to trigger immediate recheck on receivers.
  useEffect(() => {
    if (!callObject) return undefined;

    const handleParticipantJoined = (event) => {
      // Only trigger for remote participants (not ourselves)
      if (event?.participant?.local) return;
      console.log(
        "[Subscription] Remote participant joined - triggering immediate recheck",
        {
          participantId: event?.participant?.session_id,
        }
      );
      setRecheckCount((c) => c + 1);
    };

    callObject.on("participant-joined", handleParticipantJoined);
    return () => callObject.off("participant-joined", handleParticipantJoined);
  }, [callObject]);

  const layoutLogTimeoutRef = useRef(null);
  const lastLayoutSignatureRef = useRef("");

  // Debounce layout logging so we only record the final resting state (e.g., after window resize)
  // instead of spamming every intermediate size.
  useEffect(() => {
    if (!myLayout) {
      if (layoutLogTimeoutRef.current) {
        clearTimeout(layoutLogTimeoutRef.current);
        layoutLogTimeoutRef.current = null;
      }
      return undefined;
    }

    if (layoutLogTimeoutRef.current) {
      clearTimeout(layoutLogTimeoutRef.current);
    }

    layoutLogTimeoutRef.current = setTimeout(() => {
      const summary = {
        grid: myLayout.grid,
        feedCount: myLayout.feeds.length,
        container: { width, height },
        feeds: myLayout.feeds.map((feed) => ({
          source: feed.source,
          media: feed.media,
          pixels: feed.pixels,
        })),
      };
      const signature = JSON.stringify(summary);
      if (signature !== lastLayoutSignatureRef.current) {
        logStageEvent("layout-updated", summary);
        lastLayoutSignatureRef.current = signature;
      }
      layoutLogTimeoutRef.current = null;
    }, 300);

    return () => {
      if (layoutLogTimeoutRef.current) {
        clearTimeout(layoutLogTimeoutRef.current);
        layoutLogTimeoutRef.current = null;
      }
    };
  }, [myLayout, width, height, logStageEvent]);

  // Effect to update subscribed tracks based on layout and participants
  useEffect(() => {
    // Guard clauses: skip work if Daily is not ready, layout hasn't been computed,
    // or there are no remote participants to manage.
    if (!callObject || callObject.isDestroyed?.()) return;
    if (!myLayout) return;
    if (dailyParticipantIds.length === 0) return;

    // Get full participant objects to access userData for fast position mapping (issue #1187).
    // When a participant joins, their position is immediately available in userData,
    // while Empirica sync can be slower. We check userData first for faster subscriptions.
    const participants = callObject.participants();

    // Helper to get position from userData (fast) or Empirica (fallback)
    const getPositionForDailyId = (dailyId) => {
      // First try userData (immediately available after join)
      const participant = participants[dailyId];
      const userDataPosition = participant?.userData?.position;
      if (userDataPosition != null) {
        return userDataPosition;
      }
      // Fall back to Empirica mapping (requires sync, for participants without userData)
      return playersByDailyId.get(dailyId);
    };

    // Filter to participants we can map (from either source)
    // Previously we blocked ALL subscriptions if ANY participant was missing a mapping,
    // which caused long delays when Empirica sync was slow (issue #1187).
    // Now we check userData first (fast) and skip truly unknown participants.
    const knownParticipantIds = dailyParticipantIds.filter(
      (dailyId) => getPositionForDailyId(dailyId) != null
    );
    const missingDailyIds = dailyParticipantIds.filter(
      (dailyId) => getPositionForDailyId(dailyId) == null
    );

    // Log unknown participants (throttled to avoid spam - only log when list changes)
    const missingSignature = missingDailyIds.sort().join(",");
    if (
      missingDailyIds.length > 0 &&
      missingSignature !== lastMissingDailyIdsRef.current
    ) {
      lastMissingDailyIdsRef.current = missingSignature;
      console.log(
        "[Subscription] Skipping unmapped Daily participants (no userData.position or Empirica mapping)",
        {
          missingDailyIds,
          proceedingWith: knownParticipantIds,
        }
      );
    } else if (missingDailyIds.length === 0) {
      lastMissingDailyIdsRef.current = "";
    }

    const nextSubscriptions = new Map();
    // For each KNOWN remote participant, figure out which layout feed they're assigned to
    // and record the audio/video flags Daily should apply.
    knownParticipantIds.forEach((dailyId) => {
      const position = getPositionForDailyId(dailyId);
      const feed = myLayout.feeds.find((f) => {
        if (f.source.type === "self") return false;
        return String(f.source.position) === String(position);
      });

      const tracks = feed
        ? {
            audio: feed.media.audio,
            video: feed.media.video,
            screenVideo: false,
          }
        : {
            audio: false,
            video: false,
            screenVideo: false,
          };
      nextSubscriptions.set(dailyId, tracks);
    });

    // Store desired subscriptions in module-level ref for FixAV error reporting
    latestDesiredSubscriptions.current = nextSubscriptions;

    // Log desired subscription state for debugging (appears in Sentry breadcrumbs)
    // Only log when the desired state actually changes to avoid spam
    const desiredStateSignature = JSON.stringify(
      [...nextSubscriptions.entries()]
        .sort()
        .map(([id, t]) => [id, t.audio, t.video])
    );
    if (desiredStateSignature !== lastDesiredStateRef.current) {
      console.log(
        "[Subscription] Desired state:",
        Object.fromEntries(
          [...nextSubscriptions.entries()].map(([id, t]) => [
            id.slice(0, 8),
            { a: t.audio, v: t.video },
          ])
        )
      );
      lastDesiredStateRef.current = desiredStateSignature;
    }

    // ----------------------------------------------------------------
    // Active Reconciliation Strategy:
    // Compare "Desired State" (from layout) vs "Actual State" (from Daily API).
    // If they mismatch, send an update to repair the state.
    // ----------------------------------------------------------------
    const activeParticipants = callObject.participants();
    let repairNeeded = false;
    const updates = {};

    // Check if we're in cooldown period after a recent repair attempt
    const now = Date.now();
    const inCooldown = now - lastRepairAttemptRef.current < REPAIR_COOLDOWN_MS;

    // Periodic status check to catch subscription drift and help diagnose issues.
    // NOTE: This check runs permanently (every 10s) to proactively detect and repair
    // subscription problems. Currently logs all checks for debugging. Once connection
    // issues are resolved, update this to only log when mismatches are detected.
    // TODO: Change to only log mismatches after debugging phase is complete.
    const shouldLogStatus =
      now - lastStatusLogRef.current > STATUS_LOG_INTERVAL_MS;
    if (shouldLogStatus && dailyParticipantIds.length > 0) {
      lastStatusLogRef.current = now;
      // CHECK FOR BLOCKED TRACKS and warn only on state transitions (avoid spam)
      dailyParticipantIds.forEach((dailyId) => {
        const actual = activeParticipants[dailyId];
        const audioBlocked = actual?.tracks?.audio?.blocked;
        const videoBlocked = actual?.tracks?.video?.blocked;
        const currentBlockedState = { audioBlocked, videoBlocked };
        const lastBlockedState = lastBlockedStateRef.current[dailyId];

        // Only warn if blocked state changed from last check
        if (
          (audioBlocked || videoBlocked) &&
          JSON.stringify(currentBlockedState) !==
            JSON.stringify(lastBlockedState)
        ) {
          console.warn(
            `[Subscription] Remote tracks blocked for ${dailyId.slice(0, 8)}:`,
            {
              audioBlocked,
              videoBlocked,
              audioState: actual?.tracks?.audio?.state,
              videoState: actual?.tracks?.video?.state,
            }
          );
          lastBlockedStateRef.current[dailyId] = currentBlockedState;
        } else if (!audioBlocked && !videoBlocked) {
          // Clear blocked state when tracks are no longer blocked
          delete lastBlockedStateRef.current[dailyId];
        }
      });
    }

    nextSubscriptions.forEach((desired, dailyId) => {
      const actual = activeParticipants[dailyId];
      // If participant is gone from Daily but we still think they are here, skip (will be cleaned up by list update)
      if (!actual) return;

      // Check if tracks are in a state where subscription can work.
      // Daily track states: "blocked", "off", "sendable", "loading", "playable", "interrupted"
      // We should only try to subscribe if the track exists and is potentially receivable.
      const audioTrack = actual.tracks?.audio;
      const videoTrack = actual.tracks?.video;

      // A track is "subscribable" if it exists and has a state (meaning the remote is sending it)
      const audioSubscribable = audioTrack && audioTrack.state;
      const videoSubscribable = videoTrack && videoTrack.state;

      const actualAudio = audioTrack?.subscribed === true;
      const actualVideo = videoTrack?.subscribed === true;
      const actualScreen = actual.tracks?.screenVideo?.subscribed === true;

      // Determine if we need to repair each track type.
      // Two cases require repair:
      //   1. We WANT the track, it's subscribable, but we're NOT subscribed → subscribe
      //   2. We DON'T want the track, but we ARE subscribed → unsubscribe
      // We skip repair if we want a track but it's not subscribable (remote not sending yet).
      const wantAudioButNotSubscribed =
        desired.audio && audioSubscribable && !actualAudio;
      const unwantedAudioButSubscribed = !desired.audio && actualAudio;
      const shouldRepairAudio =
        wantAudioButNotSubscribed || unwantedAudioButSubscribed;

      const wantVideoButNotSubscribed =
        desired.video && videoSubscribable && !actualVideo;
      const unwantedVideoButSubscribed = !desired.video && actualVideo;
      const shouldRepairVideo =
        wantVideoButNotSubscribed || unwantedVideoButSubscribed;

      const shouldRepairScreen = desired.screenVideo !== actualScreen;

      if (shouldRepairAudio || shouldRepairVideo || shouldRepairScreen) {
        updates[dailyId] = { setSubscribedTracks: desired };
        repairNeeded = true;
      }
    });

    // Also unsubscribe anyone we no longer want (cleanup)
    // We check against dailyParticipantIds to see who is *currently* remote
    // and if they are NOT in our `nextSubscriptions` map, ensure they are off.
    dailyParticipantIds.forEach((dailyId) => {
      if (!nextSubscriptions.has(dailyId)) {
        const actual = activeParticipants[dailyId];
        if (!actual) return;

        const isSubscribedSomething =
          actual.tracks?.audio?.subscribed === true ||
          actual.tracks?.video?.subscribed === true ||
          actual.tracks?.screenVideo?.subscribed === true;

        if (isSubscribedSomething) {
          updates[dailyId] = {
            setSubscribedTracks: {
              audio: false,
              video: false,
              screenVideo: false,
            },
          };
          repairNeeded = true;
        }
      }
    });

    if (repairNeeded && !inCooldown) {
      console.log("[Subscription] Applying updates:", updates);
      callObject.updateParticipants(updates);
      lastRepairAttemptRef.current = now;

      // Verification: check subscription state after a delay to confirm updates took effect
      setTimeout(() => {
        if (callObject.isDestroyed?.()) return;
        const verifyParticipants = callObject.participants();
        const verificationResults = [];

        nextSubscriptions.forEach((desired, dailyId) => {
          const actual = verifyParticipants[dailyId];
          if (!actual) return;

          const actualState = {
            audio: actual.tracks?.audio?.subscribed,
            video: actual.tracks?.video?.subscribed,
            audioTrackState: actual.tracks?.audio?.state,
            videoTrackState: actual.tracks?.video?.state,
          };

          const audioMatch = desired.audio === (actualState.audio === true);
          const videoMatch = desired.video === (actualState.video === true);

          if (!audioMatch || !videoMatch) {
            verificationResults.push({
              dailyId,
              desired: { audio: desired.audio, video: desired.video },
              actual: actualState,
              audioMatch,
              videoMatch,
            });
          }
        });

        if (verificationResults.length > 0) {
          console.warn(
            "[Subscription] Verification FAILED - mismatches found:",
            verificationResults
          );
        } else {
          console.log(
            "[Subscription] Verification OK - all subscriptions match desired state"
          );
        }
      }, 500);
    }
    // We do NOT update a "lastSubscriptionsRef" because we always want to compare against "Reality"
  }, [
    callObject,
    myLayout,
    dailyParticipantIds,
    playersSubscriptionSignature, // keep this to react to player changes faster than the interval
    playersByDailyId,
    recheckCount, // Trigger periodically
  ]);

  const soloRoom = useMemo(() => {
    if (!myLayout) return false;
    const otherPositionsExpected = myLayout.feeds.some(
      (feed) => feed.source.type !== "self"
    ); // Whether they are connected or not, if they are supposed to be there, it's not a solo room
    return !otherPositionsExpected;
  }, [myLayout]);

  // Ensure the call keeps a visible footprint on narrow layouts where the discussion
  // column stacks vertically; larger breakpoints can continue to flex freely.
  return (
    <div
      ref={containerRef}
      className="relative h-full w-full max-w-full bg-black/80 min-h-[320px] md:min-h-0"
    >
      {soloRoom && (
        <div
          className="pointer-events-none absolute top-4 inset-x-0 z-20 flex justify-center px-4 text-center"
          aria-live="polite"
        >
          <div className="rounded-xl bg-black/70 px-4 py-2 text-sm font-medium text-white shadow-lg">
            You are the only participant assigned to this room.
          </div>
        </div>
      )}
      {myLayout &&
        myLayout.feeds.map((feed) => (
          <div
            key={JSON.stringify(feed.source)}
            className="absolute"
            style={{
              left: feed.pixels.left,
              top: feed.pixels.top,
              width: feed.pixels.width,
              height: feed.pixels.height,
              zIndex: feed.zOrder,
            }}
          >
            <Tile
              source={feed.source}
              media={feed.media}
              pixels={feed.pixels}
            />
          </div>
        ))}
    </div>
  );
}
