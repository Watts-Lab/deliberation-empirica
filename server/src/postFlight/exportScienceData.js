/**
 * Science-data export orchestrator.
 *
 * The pure shape-building logic lives in ./scienceDataHelpers so it can be
 * unit-tested without mocking the filesystem or GitHub client. This module
 * handles the I/O: validation-error surfacing, JSONL write, and GitHub push.
 */
import { error } from "@empirica/core/console";
import * as Sentry from "@sentry/node";
import { pushDataToGithub } from "../providers/github";
import { buildPlayerData, validateDailyIdHistory } from "./scienceDataHelpers";
import { collectExportErrors } from "../utils/exportErrors";
import { appendJsonlLine } from "../utils/appendJsonlLine";

export async function exportScienceData({ player, batch, game }) {
  try {
    const exportErrors = collectExportErrors({ player, batch, game });
    for (const err of exportErrors) error(err);

    const playerData = buildPlayerData({
      player,
      batch,
      game,
      containerTag: process.env.CONTAINER_IMAGE_VERSION_TAG,
      exportErrors,
    });

    // Surface stage→dailyId mapping loss. A completed player with fewer
    // dailyIdHistory entries than video stages is the symptom of the
    // 156-participant bug fixed by the coherence gate; alert if it ever
    // recurs rather than silently exporting bad data.
    const historyReport = validateDailyIdHistory({ player, game });
    if (historyReport) {
      Sentry.captureMessage("dailyIdHistory shorter than video-stage count", {
        level: "warning",
        extra: { ...historyReport, batchId: batch?.id },
      });
    }

    appendJsonlLine({
      filename: batch.get("scienceDataFilename"),
      data: playerData,
      label: "science data",
      playerId: player.id,
    });
    await pushDataToGithub({ batch });
  } catch (err) {
    error("Uncaught exception in exportScienceData.js :", err);
  }
}
