/**
 * Pre-registration JSONL export orchestrator.
 *
 * Pure shape-building logic lives in ./preregisterHelpers; this module
 * handles side effects: UUID minting, writing the JSONL line, and pushing
 * to GitHub.
 */
import * as fs from "fs";
import { randomUUID } from "crypto";
import { error, info } from "@empirica/core/console";
import { pushPreregToGithub } from "../providers/github";
import {
  buildPreregData,
  collectExportErrors,
} from "./preregisterHelpers";

export function preregisterSample({ player, batch, game }) {
  try {
    const sampleId = randomUUID();
    const exportErrors = collectExportErrors({ player, batch, game });
    for (const err of exportErrors) error(err);

    const data = buildPreregData({
      sampleId,
      player,
      batch,
      game,
      exportErrors,
    });

    player.set("sampleId", sampleId);

    const outFileName = batch.get("preregistrationDataFilename");
    fs.appendFileSync(outFileName, `${JSON.stringify(data)}\n`, (err) => {
      if (err) {
        error(
          `Failed to write preregistration data for player ${player.id} to ${outFileName}`,
          err
        );
      } else {
        info(
          `Writing preregistration data for player ${player.id} to ${outFileName}`
        );
      }
    });

    pushPreregToGithub({ batch });
  } catch (err) {
    error("Uncaught exception in preregister.js :", err);
  }
}
