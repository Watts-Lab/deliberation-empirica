/**
 * Pre-registration JSONL export orchestrator.
 *
 * Pure shape-building logic lives in ./preregisterHelpers; this module
 * handles side effects: UUID minting, writing the JSONL line, and pushing
 * to GitHub.
 */
import { randomUUID } from "crypto";
import { error } from "@empirica/core/console";
import { pushPreregToGithub } from "../providers/github";
import { buildPreregData } from "./preregisterHelpers";
import { collectExportErrors } from "../utils/exportErrors";
import { appendJsonlLine } from "../utils/appendJsonlLine";

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

    appendJsonlLine({
      filename: batch.get("preregistrationDataFilename"),
      data,
      label: "preregistration data",
      playerId: player.id,
    });

    pushPreregToGithub({ batch });
  } catch (err) {
    error("Uncaught exception in preregister.js :", err);
  }
}
