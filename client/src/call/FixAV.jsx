import React, { useCallback, useState } from "react";
import * as Sentry from "@sentry/react";
import { useDaily, useLocalSessionId } from "@daily-co/daily-react";
import { Button } from "../components/Button";

/**
 * Hook for reporting audio/video issues to Sentry and refreshing the page.
 * Returns an openFixAV function to show the issue reporting modal and
 * a FixAVModal component to render in the parent.
 */
export function useFixAV() {
  const callObject = useDaily();
  const localSessionId = useLocalSessionId();
  const [showFixModal, setShowFixModal] = useState(false);
  const [selectedIssues, setSelectedIssues] = useState([]);

  const openFixAV = useCallback(() => {
    setShowFixModal(true);
    setSelectedIssues([]);
  }, []);

  const toggleIssue = useCallback((issueValue) => {
    setSelectedIssues((prev) =>
      prev.includes(issueValue)
        ? prev.filter((v) => v !== issueValue)
        : [...prev, issueValue]
    );
  }, []);

  const handleSubmitFix = useCallback(() => {
    if (selectedIssues.length === 0) return;

    // Capture current state for debugging
    const participants = callObject?.participants?.() || {};
    const participantSummary = Object.entries(participants).map(([id, p]) => ({
      id: id.slice(0, 8),
      local: p.local,
      audio: {
        subscribed: p.tracks?.audio?.subscribed,
        state: p.tracks?.audio?.state,
      },
      video: {
        subscribed: p.tracks?.video?.subscribed,
        state: p.tracks?.video?.state,
      },
    }));

    const reportData = {
      userReportedIssues: selectedIssues,
      participants: participantSummary,
      meetingState: callObject?.meetingState?.(),
      localSessionId,
    };

    // Log to console (appears in Sentry breadcrumbs)
    console.log("[AV Issue] User reported problem:", reportData);

    // Send to Sentry
    if (Sentry?.captureMessage) {
      Sentry.captureMessage("reportedAVError", {
        level: "error",
        extra: reportData,
      });
    }

    // Close modal and refresh page to attempt recovery
    setShowFixModal(false);
    window.location.reload();
  }, [callObject, localSessionId, selectedIssues]);

  const handleCancelFix = useCallback(() => {
    setShowFixModal(false);
    setSelectedIssues([]);
  }, []);

  const FixAVModal = useCallback(
    () =>
      showFixModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              What problems are you experiencing?
            </h2>
            <p className="mb-4 text-sm text-slate-600">Select all that apply</p>
            <div className="mb-6 space-y-3">
              {[
                {
                  value: "cant-hear",
                  label: "I can't hear other participants",
                },
                { value: "cant-see", label: "I can't see other participants" },
                {
                  value: "others-cant-hear-me",
                  label: "Others can't hear me",
                },
                { value: "others-cant-see-me", label: "Others can't see me" },
                { value: "other", label: "Something else" },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    value={option.value}
                    checked={selectedIssues.includes(option.value)}
                    onChange={() => toggleIssue(option.value)}
                    className="h-4 w-4 rounded text-blue-600"
                  />
                  <span className="text-slate-700">{option.label}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <Button
                primary={false}
                handleClick={handleCancelFix}
                className="px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                primary
                handleClick={handleSubmitFix}
                disabled={selectedIssues.length === 0}
                className="px-4 py-2"
              >
                Submit &amp; Reload page
              </Button>
            </div>
          </div>
        </div>
      ) : null,
    [
      showFixModal,
      selectedIssues,
      toggleIssue,
      handleSubmitFix,
      handleCancelFix,
    ]
  );

  return { openFixAV, FixAVModal };
}
