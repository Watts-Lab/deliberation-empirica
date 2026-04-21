/**
 * Science-data export orchestrator.
 *
 * The pure shape-building logic lives in ./scienceDataHelpers so it can be
 * unit-tested without mocking the filesystem or GitHub client. This module
 * handles the I/O: validation-error surfacing, JSONL write, and GitHub push.
 */
import * as fs from "fs";
import { error, info } from "@empirica/core/console";
import { pushDataToGithub } from "../providers/github";
import {
  buildPlayerData,
  collectExportErrors,
} from "./scienceDataHelpers";

export async function exportScienceData({ player, batch, game }) {
  try {
    const exportErrors = collectExportErrors({ player, batch, game });
    for (const err of exportErrors) error(err);

    const outFileName = batch.get("scienceDataFilename");
    const playerData = buildPlayerData({
      player,
      batch,
      game,
      containerTag: process.env.CONTAINER_IMAGE_VERSION_TAG,
      exportErrors,
    });

    try {
      fs.appendFileSync(outFileName, `${JSON.stringify(playerData)}\n`);
      info(`Writing science data for player ${player.id} to ${outFileName}`);
    } catch (err) {
      error(
        `Failed to write science data for player ${player.id} to ${outFileName}`,
        err
      );
    }
    await pushDataToGithub({ batch });
  } catch (err) {
    error("Uncaught exception in exportScienceData.js :", err);
  }
}
