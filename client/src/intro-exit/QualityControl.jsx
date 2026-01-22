import { useGame, usePlayer } from "@empirica/core/player/classic/react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from "react";
import { DiscussionQualityControl } from "@watts-lab/surveys";

const QualityControlSurveyInner = memo(DiscussionQualityControl);

export function QualityControl({ next }) {
  const player = usePlayer();
  const playerRef = useRef(player);
  const nextRef = useRef(next);
  const game = useGame();
  const [rerenderTick, setRerenderTick] = useState(0);
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

  const shouldStressRerender =
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    window.Cypress &&
    window.localStorage?.getItem("qc_rerender_stress") === "1";

  useEffect(() => {
    console.log("Exit: QC Exit");
  }, []);

  // Cypress-only rerender stressor used to reproduce input-reset bugs
  // by forcing parent re-renders while the participant is typing.
  useEffect(() => {
    if (!shouldStressRerender) {
      return () => {};
    }
    const id = window.setInterval(() => {
      setRerenderTick((t) => t + 1);
    }, 250);
    return () => {
      window.clearInterval(id);
    };
  }, [shouldStressRerender]);

  const onComplete = useCallback(
    (record) => {
      // Use a ref so the callback doesn't churn if `usePlayer()` returns a new wrapper.
      playerRef.current.set("QCSurvey", record);
      playerRef.current.set("playerComplete", true);
      nextRef.current();
    },
    []
  );

  const storageName = useMemo(() => storageNameRef.current, []);

  const renderSorry = () => (
    <div className="ml-25 w-xl">
      <h1>Sorry you did not get to play today.</h1>
    </div>
  );

  return (
    <div>
      {!game && renderSorry()}
      {/* rerenderTick is intentionally unused except to trigger re-renders */}
      {rerenderTick >= 0 && (
        <QualityControlSurveyInner onComplete={onComplete} storageName={storageName} />
      )}
    </div>
  );
}
