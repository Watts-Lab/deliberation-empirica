/**
 * Science-data export orchestrator.
 *
 * The pure shape-building logic lives in ./scienceDataHelpers so it can be
 * unit-tested without mocking the filesystem or GitHub client. This module
 * handles the I/O: validation-error surfacing, JSONL write, and GitHub push.
 */
import { error } from "@empirica/core/console";
import { pushDataToGithub } from "../providers/github";
import { buildPlayerData } from "./scienceDataHelpers";
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
