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

      {/*
      Uncomment block below to enable Cypress rerender stress for e2e regression:
      */}

      {/* <CypressRerenderStress>
        <QualityControlSurveyInner
          onComplete={onComplete}
          storageName={storageName}
        />
      </CypressRerenderStress> */}

      {/* Comment out the above and uncomment below for normal/prod use: */}
      <QualityControlSurveyInner
        onComplete={onComplete}
        storageName={storageName}
      />
    </div>
  );
}

/*
CYPRESS RERENDER STRESS HARNESS
--------------------------------
Purpose:
  This local test wrapper is used to reproduce and catch input-reset bugs in the QC survey step.
  It forces repeated parent re-renders during typing, simulating the conditions that caused
  user-reported issues (e.g., text fields clearing mid-typing due to prop or callback churn).

Usage:
  - Uncomment the <CypressRerenderStress> block in the QC render below to enable the harness.
  - The wrapper will only activate in development mode, when running under Cypress,
    and when localStorage.qc_rerender_stress === "1" (set by the e2e test).
  - Comment out the block for normal/prod use; the harness is a no-op unless enabled.

When to use:
  - Enable during e2e regression test development or debugging to ensure the QC fix
    prevents input resets under rerender stress.
  - Disable (comment out) for production, normal development, or when not running Cypress tests.

How it works:
  - Forces a parent rerender every 250ms while enabled, without changing props or state.
  - If the QC fix is correct, input fields will not clear/reset during typing.
  - If the fix is missing or broken, the e2e test will fail with an assertion that the input was cleared.
*/
// function CypressRerenderStress({ children, intervalMs = 250 }) {
//   const [, forceRerender] = useReducer((x) => x + 1, 0);
//   const enabled = useMemo(
//     () =>
//       import.meta.env.DEV &&
//       typeof window !== "undefined" &&
//       window.Cypress &&
//       window.localStorage?.getItem("qc_rerender_stress") === "1",
//     []
//   );
//   useEffect(() => {
//     if (!enabled) return undefined;
//     const id = window.setInterval(() => {
//       forceRerender();
//     }, intervalMs);
//     return () => {
//       window.clearInterval(id);
//     };
//   }, [enabled, intervalMs]);
//   return children;
// }
