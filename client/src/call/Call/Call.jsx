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
  const includeSelfTile = showSelfView && Boolean(localSessionId);

  const visibleRemoteParticipantIds = useMemo(() => {
    const remainingSlots = MAX_STREAMS - (includeSelfTile ? 1 : 0);
    return remoteParticipantIds.slice(0, Math.max(0, remainingSlots));
  }, [remoteParticipantIds, includeSelfTile]);

  const participantCount = includeSelfTile
    ? 1 + visibleRemoteParticipantIds.length
    : visibleRemoteParticipantIds.length;

  const columns = useMemo(() => {
    if (participantCount <= 2) return 1;
    if (participantCount <= 6) return 2;
    return 3;
  }, [participantCount]);

  const rows = useMemo(() => {
    if (participantCount === 0) return 1;
    return Math.ceil(participantCount / columns);
  }, [participantCount, columns]);

  const gridColsClass = useMemo(() => {
    if (columns === 1) return "grid-cols-1";
    if (columns === 2) return "grid-cols-2";
    return "grid-cols-3";
  }, [columns]);

  const containerRef = useRef(null);
  const [tileSize, setTileSize] = useState({ width: 0, height: 0 });

  const recomputeTileSize = useCallback(() => {
    const container = containerRef.current;
    if (!container || participantCount === 0) {
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
    const finalWidth = Math.max(
      0,
      Math.min(widthPerColumn, widthFromHeight)
    );
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
  }, [columns, rows, participantCount]);

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
        gap-6 p-6
        ${participantCount === 0 ? "grid-cols-1" : gridColsClass}
      `}
      style={{
        gridTemplateColumns:
          tileSize.width > 0
            ? `repeat(${columns}, ${tileSize.width}px)`
            : undefined,
        gridAutoRows:
          tileSize.height > 0 ? `${tileSize.height}px` : undefined,
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
      {visibleRemoteParticipantIds.length > 0 ? (
        <>
          {visibleRemoteParticipantIds.map((id) => (
            <Tile
              key={id}
              id={id}
              showNickname={showNickname}
              showTitle={showTitle}
              dimensions={tileSize}
            />
          ))}
        </>
      ) : (
        // When there are no remote participants
        <div
          className="info-box"
          style={{ gridColumn: `1 / span ${columns}` }}
        >
          <h1>Waiting for other participant(s) to join</h1>
        </div>
      )}
    </div>
  );

  return getUserMediaError ? <UserMediaError /> : renderCallScreen();
}
