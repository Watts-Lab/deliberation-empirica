import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import {
  useParticipantIds,
  useDailyEvent,
  useLocalSessionId,
} from "@daily-co/daily-react";
import { usePlayers } from "@empirica/core/player/classic/react";

import { Tile } from "../Tile/Tile";
import UserMediaError from "../UserMediaError/UserMediaError";

const MAX_STREAMS = 12;
const VIDEO_ASPECT_RATIO = 16 / 9;

export function Call({ showNickname, showTitle, showSelfView = true }) {
  /* If a participant runs into a getUserMedia() error, we need to warn them. */
  const [getUserMediaError, setGetUserMediaError] = useState(false);

  /* We can use the useDailyEvent() hook to listen for daily-js events. Here's a full list
   * of all events: https://docs.daily.co/reference/daily-js/events */
  useDailyEvent(
    "camera-error",
    useCallback(() => {
      setGetUserMediaError(true);
    }, [])
  );

  /* This is for displaying remote participants */
  const remoteParticipantIds = useParticipantIds({ filter: "remote" });

  /* This is for displaying our self-view. */
  const localSessionId = useLocalSessionId();
  const players = usePlayers();
  const includeSelfTile = showSelfView && Boolean(localSessionId);

  const visibleRemoteParticipantIds = useMemo(() => {
    const remainingSlots = MAX_STREAMS - (includeSelfTile ? 1 : 0);
    return remoteParticipantIds.slice(0, Math.max(0, remainingSlots));
  }, [remoteParticipantIds, includeSelfTile]);

  const expectedTileCount = useMemo(() => {
    const totalPlayers = players?.length ?? 0;
    const expectedRemote = Math.max(totalPlayers - 1, 0);
    const expectedWithSelf = Math.min(1 + expectedRemote, MAX_STREAMS);
    const expectedWithoutSelf = Math.min(expectedRemote, MAX_STREAMS);
    return includeSelfTile ? expectedWithSelf : expectedWithoutSelf;
  }, [players, includeSelfTile]);

  const actualTileCount = includeSelfTile
    ? 1 + visibleRemoteParticipantIds.length
    : visibleRemoteParticipantIds.length;

  const targetTileCount = Math.max(actualTileCount, expectedTileCount);

  const columns = useMemo(() => {
    if (targetTileCount <= 2) return 1;
    if (targetTileCount <= 6) return 2;
    return 3;
  }, [targetTileCount]);

  const rows = useMemo(() => {
    if (targetTileCount === 0) return 1;
    return Math.ceil(targetTileCount / columns);
  }, [targetTileCount, columns]);

  const gridColsClass = useMemo(() => {
    if (columns === 1) return "grid-cols-1";
    if (columns === 2) return "md:grid-cols-2 grid-cols-1";
    return "xl:grid-cols-3 md:grid-cols-2 grid-cols-1";
  }, [columns]);

  const missingCount = Math.max(0, expectedTileCount - actualTileCount);

  const containerRef = useRef(null);
  const [tileSize, setTileSize] = useState({ width: 0, height: 0 });

  const recomputeTileSize = useCallback(() => {
    const container = containerRef.current;
    if (!container || targetTileCount === 0) {
      setTileSize({ width: 0, height: 0 });
      return;
    }

    const styles = getComputedStyle(container);
    const paddingX =
      parseFloat(styles.paddingLeft || "0") +
      parseFloat(styles.paddingRight || "0");
    const paddingY =
      parseFloat(styles.paddingTop || "0") +
      parseFloat(styles.paddingBottom || "0");
    const columnGap = parseFloat(styles.columnGap || styles.gap || "0");
    const rowGap = parseFloat(styles.rowGap || styles.gap || "0");

    const containerWidth = container.clientWidth - paddingX;
    const containerHeight = container.clientHeight - paddingY;

    if (containerWidth <= 0 || containerHeight <= 0) {
      setTileSize({ width: 0, height: 0 });
      return;
    }

    const availableWidth = containerWidth - columnGap * (columns - 1);
    const availableHeight = containerHeight - rowGap * (rows - 1);

    if (availableWidth <= 0 || availableHeight <= 0) {
      setTileSize({ width: 0, height: 0 });
      return;
    }

    const widthPerColumn = availableWidth / columns;
    const heightPerRow = availableHeight / rows;
    const widthFromHeight = heightPerRow * VIDEO_ASPECT_RATIO;
    const finalWidth = Math.max(0, Math.min(widthPerColumn, widthFromHeight));
    const finalHeight = finalWidth / VIDEO_ASPECT_RATIO;

    setTileSize((prev) => {
      if (
        Math.abs(prev.width - finalWidth) < 0.5 &&
        Math.abs(prev.height - finalHeight) < 0.5
      ) {
        return prev;
      }
      return { width: finalWidth, height: finalHeight };
    });
  }, [columns, rows, targetTileCount]);

  useEffect(() => {
    recomputeTileSize();
  }, [recomputeTileSize]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ResizeObserver) {
      return undefined;
    }

    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      recomputeTileSize();
    });

    observer.observe(container);

    return () => observer.disconnect();
  }, [recomputeTileSize]);

  const renderCallScreen = () => (
    <div
      ref={containerRef}
      className={`
        relative grid h-full w-full max-w-full items-stretch justify-items-center
        gap-3 bg-slate-950/30 p-4 pb-1
        ${targetTileCount === 0 ? "grid-cols-1" : gridColsClass}
      `}
      style={{
        gridTemplateColumns:
          tileSize.width > 0
            ? `repeat(${columns}, ${tileSize.width}px)`
            : undefined,
        gridAutoRows: tileSize.height > 0 ? `${tileSize.height}px` : undefined,
        justifyContent: "center",
        alignContent: "center",
      }}
    >
      {/* Your self view */}
      {includeSelfTile && (
        <Tile
          id={localSessionId}
          isLocal
          showNickname={showNickname}
          showTitle={showTitle}
          dimensions={tileSize}
        />
      )}
      {/* Videos of remote participants */}
      {visibleRemoteParticipantIds.map((id) => (
        <Tile
          key={id}
          id={id}
          showNickname={showNickname}
          showTitle={showTitle}
          dimensions={tileSize}
        />
      ))}

      {missingCount > 0 &&
        Array.from({ length: missingCount }).map((_, idx) => (
          <div
            key={`waiting-${idx}`}
            className="flex h-full w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-400 bg-slate-900/40 text-center text-slate-200"
            style={{
              width: tileSize.width > 0 ? `${tileSize.width}px` : undefined,
              height: tileSize.height > 0 ? `${tileSize.height}px` : undefined,
            }}
          >
            <p className="text-lg font-semibold">
              {idx === 0
                ? missingCount === 1
                  ? "Waiting for 1 more participant"
                  : `Waiting for ${missingCount} more participants`
                : "Waiting for participant…"}
            </p>
            {idx === 0 && (
              <p className="text-sm text-slate-400">
                We’ll add their video here when they join.
              </p>
            )}
          </div>
        ))}
    </div>
  );

  return getUserMediaError ? <UserMediaError /> : renderCallScreen();
}
