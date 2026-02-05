import { useEffect, useRef } from "react";
import * as Sentry from "@sentry/react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { useDaily, useLocalSessionId } from "@daily-co/daily-react";
import { collectAVDiagnostics } from "./FixAV";

/**
 * Hook that automatically responds to diagnostic requests from other participants.
 *
 * When another participant in the same room reports an A/V issue, they set a flag
 * on this player's object requesting diagnostics. This hook detects that request,
 * captures diagnostic data, sends it to Sentry with a shared issue ID for correlation,
 * and enforces a 60-second cooldown to prevent spam.
 *
 * The hook runs silently in the background - roommates are never notified that their
 * diagnostics were captured.
 */
export function useAutoDiagnostics() {
  const player = usePlayer();
  const callObject = useDaily();
  const localSessionId = useLocalSessionId();

  // Track last processed timestamp to avoid processing the same request twice
  const lastProcessedTimestampRef = useRef(0);

  // Track cooldown period (60 seconds after sending diagnostics)
  const cooldownUntilRef = useRef(0);

  useEffect(() => {
    if (!player || !callObject || !localSessionId) return;

    // Get all diagnostic requests for this player
    const requests = player.get("avDiagnosticRequests") || [];
    if (requests.length === 0) return;

    // Get the most recent request
    const latestRequest = requests[requests.length - 1];

    // Skip if we've already processed this request
    if (latestRequest.timestamp <= lastProcessedTimestampRef.current) {
      return;
    }

    // Skip if we're in cooldown period
    const now = Date.now();
    if (now < cooldownUntilRef.current) {
      console.log(
        "[AvDiagnostics] Ignoring request during cooldown period",
        {
          avIssueId: latestRequest.avIssueId,
          cooldownRemaining: Math.ceil((cooldownUntilRef.current - now) / 1000),
        }
      );
      // Still mark as processed so we don't keep logging this message
      lastProcessedTimestampRef.current = latestRequest.timestamp;
      return;
    }

    // Skip self-requests (shouldn't happen, but be defensive)
    if (latestRequest.reporterId === localSessionId) {
      console.log("[AvDiagnostics] Skipping self-request");
      lastProcessedTimestampRef.current = latestRequest.timestamp;
      return;
    }

    console.log(
      "[AvDiagnostics] Processing diagnostic request from roommate",
      {
        avIssueId: latestRequest.avIssueId,
        reporterPosition: latestRequest.reporterPosition,
        stage: latestRequest.stage,
      }
    );

    // Mark this request as processed and set cooldown
    lastProcessedTimestampRef.current = latestRequest.timestamp;
    cooldownUntilRef.current = now + 60000; // 60 seconds

    // Capture and send diagnostics asynchronously
    (async () => {
      try {
        const diagnosticData = await collectAVDiagnostics(
          callObject,
          localSessionId
        );

        // Send to Sentry with shared avIssueId for correlation
        // Use "info" level since this is not an error for the roommate
        Sentry.captureMessage("avDiagnosticResponse", {
          level: "info",
          tags: {
            avIssueId: latestRequest.avIssueId,
            isAutoDiagnostic: true,
            reporterPosition: latestRequest.reporterPosition,
          },
          extra: {
            ...diagnosticData,
            avIssueId: latestRequest.avIssueId,
            originalReport: {
              userReportedIssues: latestRequest.userReportedIssues,
              reporterPosition: latestRequest.reporterPosition,
              reporterId: latestRequest.reporterId,
              stage: latestRequest.stage,
            },
          },
        });

        console.log(
          "[AvDiagnostics] Successfully sent diagnostic response",
          { avIssueId: latestRequest.avIssueId }
        );
      } catch (err) {
        console.error("[AvDiagnostics] Failed to capture diagnostics:", err);
      }
    })();
  }, [player, callObject, localSessionId]);
}
