import React, { useState, useRef, useLayoutEffect, useMemo } from "react";

import { usePlayer, usePlayers } from "@empirica/core/player/classic/react";
import { defaultResponsiveLayout } from "./layouts/defaultResponsiveLayout";
import { computePixelsForLayout } from "./layouts/computePixelsForLayout";
import { Tile } from "./Tile";
import { useStageEventLogger } from "./hooks/eventLogger";

export function Call({ showSelfView = true, layout }) {
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
