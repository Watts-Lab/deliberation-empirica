import React from "react";
import {
  ReportMissingProvider,
  useReportMissing,
} from "../../../../client/src/components/discussion/call/ReportMissing";

/**
 * Harness for ReportMissing CT.
 *
 * The ReportParticipantMissing modal opens via a context callback
 * (`useReportMissing().openReportMissing()`). We expose a tiny test
 * button that calls into that context — similar to how Tray opens it
 * — so tests can drive the modal without dragging in the full Tray.
 *
 * The MissingParticipantRespond ("Are you there?") modal renders
 * automatically based on `game.checkInRequests` + the current
 * `progressLabel`, so it doesn't need a trigger button — just the
 * right pre-mount game state.
 *
 * Lives in a separate file because Playwright CT only mounts
 * statically importable components.
 */
function OpenReportMissingButton() {
  const { openReportMissing } = useReportMissing();
  return (
    <button
      type="button"
      data-testid="reportMissing"
      onClick={openReportMissing}
    >
      Open Report Missing
    </button>
  );
}

export function ReportMissingHarness() {
  return (
    <ReportMissingProvider>
      <OpenReportMissingButton />
    </ReportMissingProvider>
  );
}
