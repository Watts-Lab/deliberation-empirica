import { useGame, usePlayer } from "@empirica/core/player/classic/react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  // useReducer, // used in the rerender stress test
  memo,
} from "react";
import { DiscussionQualityControl } from "@watts-lab/surveys";

const QualityControlSurveyInner = memo(DiscussionQualityControl);

export function QualityControl({ next }) {
  const player = usePlayer();
  const playerRef = useRef(player);
  const nextRef = useRef(next);
  const game = useGame();
  const storageNameRef = useRef(null);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    nextRef.current = next;
  }, [next]);

  const resolvedGameId =
    game?.id || player.get("gameID") || player.get("gameId") || null;

  // Freeze storageName once we have a real game id to avoid mid-step churn.
  if (!storageNameRef.current) {
    const stableGameId = resolvedGameId || "noGameId";
    storageNameRef.current = `${player.id}_${stableGameId}_QCSurvey`;
  }

  useEffect(() => {
    console.log("Exit: QC Exit");
  }, []);

  const onComplete = useCallback((record) => {
    // Use a ref so the callback doesn't churn if `usePlayer()` returns a new wrapper.
    playerRef.current.set("QCSurvey", record);
    playerRef.current.set("playerComplete", true);
    nextRef.current();
  }, []);

  const storageName = useMemo(() => storageNameRef.current, []);

  const renderSorry = () => (
    <div className="ml-25 w-xl">
      <h1>Sorry you did not get to play today.</h1>
    </div>
  );

  return (
    <div>
      {!game && renderSorry()}

      <QualityControlSurveyInner
        onComplete={onComplete}
        storageName={storageName}
      />
    </div>
  );
}
