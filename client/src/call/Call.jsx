import React, { useState, useRef, useLayoutEffect, useMemo } from "react";
import {
  useParticipantIds,
  useDailyEvent,
  useLocalSessionId,
  useDaily,
} from "@daily-co/daily-react";
import { usePlayer, usePlayers } from "@empirica/core/player/classic/react";
import { defaultResponsiveLayout } from "./layouts/defaultResponsiveLayout";
import { computePixelsForLayout } from "./layouts/computePixelsForLayout";
import { Tile } from "./Tile";

export function Call({ showNickname, showTitle, showSelfView = true, layout }) {
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
  const players = usePlayers();
  const player = usePlayer();
  const selfPosition = player.get("position");
  const selfPlayerId = player.id;

  const playerLayout = useMemo(() => {
    // if no players or zero size, can't compute layout
    if (width === 0 || height === 0) return null;

    // if we have a custom layout, always use that
    if (layout && layout[selfPosition])
      return computePixelsForLayout(layout[selfPosition], width, height);

    const playersToDisplay = showSelfView
      ? players
      : players.filter((p) => p.id !== selfPlayerId);

    // if no players can't compute layout
    if (playersToDisplay.length === 0) return null;

    // compute default responsive layout
    const defaultLayout = defaultResponsiveLayout({
      players: playersToDisplay.sort((a, b) => a.id - b.id), // consistent randomized order
      selfPosition,
      width,
      height,
      tileAspectRatio: 16 / 9,
    });
    return computePixelsForLayout(defaultLayout, width, height);
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

  return (
    <div ref={containerRef} className={`relative h-full w-full max-w-full`}>
      {false &&
        playerLayout &&
        playerLayout.feeds.map((feed) => (
          <div
            key={JSON.stringify(feed.source)}
            className="absolute bg-black/80"
            style={{
              left: feed.pixels.left,
              top: feed.pixels.top,
              width: feed.pixels.width,
              height: feed.pixels.height,
            }}
          >
            {/* <p className="p-2 text-white">
              {feed.source.type === "self"
                ? "Self View"
                : `Participant: ${feed.source.position}`}
            </p> */}
            <Tile
              source={feed.source}
              media={feed.media}
              pixels={feed.pixels}
            />
          </div>
        ))}

      <p>
        Width : {width}px, Height: {height}px
      </p>
      <p>Layout: {JSON.stringify(playerLayout)}</p>
    </div>
  );
}

// import { UserMediaError } from "./UserMediaError";
// import { normalizeDiscussionLayout } from "./layouts/normalizeLayout";
// import { buildCustomLayoutPlan } from "./layouts/planCustomLayout";
// import { CustomLayout } from "./CustomLayout";
// import { DefaultGridLayout } from "./DefaultGridLayout";

// // Renders the Daily tiles, auto-sizing them to fill the available space above the tray.
// // The layout aims to display the expected number of participants (up to 12),
// // reserving placeholder tiles when some participants have yet to join.
// export function Call({
//   showNickname,
//   showTitle,
//   showSelfView = true,
//   layout: customLayout,
// }) {
//   /* If a participant runs into a getUserMedia() error, we need to warn them. */
//   const [getUserMediaError, setGetUserMediaError] = useState(false);

//   /* We can use the useDailyEvent() hook to listen for daily-js events. Here's a full list
//    * of all events: https://docs.daily.co/reference/daily-js/events */
//   useDailyEvent(
//     "camera-error",
//     useCallback(() => {
//       setGetUserMediaError(true);
//     }, [setGetUserMediaError])
//   );

//   /* This is for displaying remote participants */
//   // Track the list of remote Daily participants currently connected to the call.
//   const remoteParticipantIds = useParticipantIds({ filter: "remote" });

//   /* This is for displaying our self-view. */
//   const localSessionId = useLocalSessionId();
//   const callObject = useDaily();
//   const players = usePlayers();
//   const player = usePlayer();
//   // Normalize the discussion.layout config (if any) into a predictable structure.
//   const normalizedLayout = useMemo(
//     () => normalizeDiscussionLayout(customLayout),
//     [customLayout]
//   );
//   // Pull the viewer's own seat number so we can choose their specific layout entry.
//   const viewerPositionRaw = player?.get("position");
//   const viewerPosition =
//     typeof viewerPositionRaw === "number" && Number.isInteger(viewerPositionRaw)
//       ? viewerPositionRaw
//       : null;
//   const seatLayouts = normalizedLayout?.seatLayouts;
//   // Map each seat position to its Empirica player record for quick lookup later.
//   const playersByPosition = useMemo(() => {
//     const map = new Map();
//     (players || []).forEach((p) => {
//       if (!p) return;
//       const position = p.get("position");
//       if (Number.isInteger(position)) {
//         map.set(position, p);
//       }
//     });
//     return map;
//   }, [players]);

//   // Grab the layout instructions for the current viewer (if defined).
//   const viewerLayout = useMemo(() => {
//     if (!seatLayouts || viewerPosition === null) {
//       return null;
//     }
//     return seatLayouts.get(viewerPosition) ?? null;
//   }, [seatLayouts, viewerPosition]);
//   // Build a render plan describing grid areas + tiles that should be mounted.
//   const customLayoutPlan = useMemo(() => {
//     if (!viewerLayout) return null;
//     return buildCustomLayoutPlan({
//       viewerLayout,
//       playersByPosition,
//       currentPlayer: player,
//       localSessionId,
//     });
//   }, [viewerLayout, playersByPosition, player, localSessionId]);

//   // Update Daily subscribe settings whenever the plan changes so we only pull tracks we need.
//   useEffect(() => {
//     if (!callObject || callObject.isDestroyed?.()) {
//       return undefined;
//     }

//     const applyDefaultSubscriptions = () => {
//       try {
//         callObject.setSubscribeSettings({
//           base: { audio: true, video: true, screenVideo: true },
//           participants: {},
//         });
//       } catch (err) {
//         console.warn("Failed to reset Daily subscribe settings", err);
//       }
//     };

//     if (!customLayoutPlan) {
//       applyDefaultSubscriptions();
//       return undefined;
//     }

//     // If any feed is supposed to show up but we don't know its session yet, keep defaults.
//     const hasUnresolvedFeeds = customLayoutPlan.items.some(
//       (item) =>
//         item.renderType !== "waiting" &&
//         !item.isLocal &&
//         !item.sessionId
//     );

//     if (hasUnresolvedFeeds) {
//       applyDefaultSubscriptions();
//       return undefined;
//     }

//     // Collect per-session subscription overrides for the feeds we actually render.
//     const participantsSettings = {};

//     customLayoutPlan.items.forEach((item) => {
//       const sessionId = item.sessionId;
//       if (!sessionId || sessionId === localSessionId) {
//         return;
//       }

//       const settings =
//         participantsSettings[sessionId] ?? {
//           audio: false,
//           video: false,
//           screenVideo: false,
//         };

//       if (item.wantsAudio) {
//         settings.audio = true;
//       }
//       if (item.wantsVideo && item.renderType === "tile") {
//         settings.video = true;
//       }
//       if (item.wantsScreen) {
//         settings.screenVideo = true;
//       }

//       participantsSettings[sessionId] = settings;
//     });

//     try {
//       callObject.setSubscribeSettings({
//         base: { audio: false, video: false, screenVideo: false },
//         participants: participantsSettings,
//       });
//     } catch (err) {
//       console.warn("Failed to apply Daily subscribe settings", err);
//     }

//     return () => {
//       // Restore Daily's defaults when the layout or component unmounts.
//       applyDefaultSubscriptions();
//     };
//   }, [callObject, customLayoutPlan, localSessionId, remoteParticipantIds]);

//   // Only render our own thumbnail when the UI requests it and we have a session.
//   const includeSelfTile = showSelfView && Boolean(localSessionId);

//   // Render the legacy auto-sizing grid when no explicit layout is provided.
//   if (getUserMediaError) {
//     return <UserMediaError />;
//   }

//   if (customLayoutPlan) {
//     return (
//       <CustomLayout
//         plan={customLayoutPlan}
//         showNickname={showNickname}
//         showTitle={showTitle}
//       />
//     );
//   }

//   return (
//     <DefaultGridLayout
//       players={players}
//       remoteParticipantIds={remoteParticipantIds}
//       localSessionId={localSessionId}
//       includeSelfTile={includeSelfTile}
//       showNickname={showNickname}
//       showTitle={showTitle}
//     />
//   );
// }
