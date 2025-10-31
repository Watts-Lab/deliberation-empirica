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

export function Call({ showSelfView = true, layout, rooms }) {
  // container size tracking
  const containerRef = useRef(null);
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    updateSize(); // measure immediately on mount

    const observer = new ResizeObserver(updateSize);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  // layout calculation
  const logger = useStageEventLogger();
  const players = usePlayers();
  const player = usePlayer();
  const selfPosition = player.get("position");
  const selfPlayerId = player.id;

  const playerLayout = useMemo(() => {
    // if no players or zero size, can't compute layout
    if (width === 0 || height === 0) return null;

    // if we have a custom layout, always use that
    if (layout && layout[selfPosition]) {
      const newLayout = computePixelsForLayout(
        layout[selfPosition],
        width,
        height
      );
      logger("set-layout", { layout: newLayout });
      console.log("Using custom layout for position", selfPosition, newLayout);
      return newLayout;
    }

    // when we have breakout rooms, figure out what room we're in and only layout those players
    let playersToDisplay = showSelfView
      ? players
      : players.filter((p) => p.id !== selfPlayerId);

    if (rooms) {
      let positionsToDisplay = [];
      rooms.forEach((room) => {
        // TODO: optimize with find instead of forEach
        const includesSelf = room.includePositions
          .map((p) => String(p))
          .includes(selfPosition);

        if (includesSelf) {
          positionsToDisplay = room.includePositions.map((p) => String(p));
        }
      });

      if (positionsToDisplay.size === 0) {
        console.warn(
          "Player position",
          selfPosition,
          "not assigned to any room in:",
          rooms
        );
      }

      playersToDisplay = playersToDisplay.filter((p) =>
        positionsToDisplay.includes(p.get("position"))
      );
    }

    // if no players can't compute layout
    if (playersToDisplay.length === 0) return null;

    // compute default responsive layout
    const defaultLayout = defaultResponsiveLayout({
      players: playersToDisplay.sort((a, b) => a.id - b.id), // consistent randomized order //TODO: check that this actually randomizes the order
      selfPosition,
      width,
      height,
      tileAspectRatio: 16 / 9,
    });
    const newLayout = computePixelsForLayout(defaultLayout, width, height);
    console.log("Using default layout for position", selfPosition, newLayout);
    logger("set-layout", { layout: newLayout });
    return newLayout;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    width,
    height,
    layout,
    selfPosition,
    showSelfView,
    selfPlayerId,
    players.length, // should never change
  ]); // intentional exclusion of players from deps, so we don't recompute every tick

  // update subscribed tracks
  const callObject = useDaily();
  const dailyParticipantIds = useParticipantIds({ filter: "remote" });

  // Clamp Daily's auto-subscribe behavior off after we join the call, just in case the
  // call object was reused or the setting was reset elsewhere.
  useEffect(() => {
    if (!callObject) return;

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

  const lastSubscriptionsRef = useRef(new Map()); // Stores the previous subscription state so we can diff instead of sending redundant updates.

  useEffect(() => {
    // Guard clauses: skip work if Daily is not ready, layout hasn't been computed,
    // or there are no remote participants to manage.
    if (!callObject || callObject.isDestroyed?.()) return;
    if (!playerLayout) return;
    if (dailyParticipantIds.length === 0) return;

    const missingMapping = dailyParticipantIds.some(
      // If any Daily participant is not yet linked to a player, we wait;
      // otherwise they would momentarily get unsubscribed while metadata loads.
      (dailyId) => !playersByDailyId.has(dailyId)
    );
    if (missingMapping) return;

    const nextSubscriptions = new Map();
    // For each remote participant, figure out which layout feed they're assigned to
    // and record the audio/video flags Daily should apply.
    dailyParticipantIds.forEach((dailyId) => {
      const position = playersByDailyId.get(dailyId);
      const feed = playerLayout.feeds.find((f) => {
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

    const updates = {};
    // We only want to call updateParticipants if something actually changed.
    let hasChanges = false;
    const lastSubscriptions = lastSubscriptionsRef.current;

    nextSubscriptions.forEach((tracks, dailyId) => {
      const prev = lastSubscriptions.get(dailyId);
      if (
        !prev ||
        prev.audio !== tracks.audio ||
        prev.video !== tracks.video ||
        prev.screenVideo !== tracks.screenVideo
      ) {
        updates[dailyId] = { setSubscribedTracks: tracks };
        hasChanges = true;
      }
    });

    lastSubscriptions.forEach((_tracks, dailyId) => {
      // Participants who disappeared should be unsubscribed once to clean up resources.
      if (!nextSubscriptions.has(dailyId)) {
        updates[dailyId] = {
          setSubscribedTracks: {
            audio: false,
            video: false,
            screenVideo: false,
          },
        };
        hasChanges = true;
      }
    });

    if (!hasChanges) return; // Nothing changed, so there's no reason to ping Daily.

    console.log("Updating subscribed tracks with:", updates);
    callObject.updateParticipants(updates);
    lastSubscriptionsRef.current = nextSubscriptions; // Remember this snapshot for next time.
  }, [
    callObject,
    playerLayout,
    dailyParticipantIds,
    playersSubscriptionSignature,
  ]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full max-w-full bg-black/80"
    >
      {playerLayout &&
        playerLayout.feeds.map((feed) => (
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
