/**
 * Append one JSON object as a newline-delimited line to a file.
 *
 * Shared by the three JSONL export orchestrators (exportScienceData,
 * preregister, exportPaymentData) which previously duplicated this write
 * shape with subtly different error-handling. Centralizing here keeps the
 * success/failure log text uniform and makes it easier to add future
 * treatments (rotation, flushing, retries) in one place.
 *
 * Returns `true` on success, `false` if the write threw. Callers that want
 * to abort further work (e.g. a GitHub push) on a failed write can check
 * the return value.
 */
import * as fs from "fs";
import { error, info } from "@empirica/core/console";

export function appendJsonlLine({ filename, data, label, playerId }) {
  try {
    fs.appendFileSync(filename, `${JSON.stringify(data)}\n`);
    info(`Writing ${label} for player ${playerId} to ${filename}`);
    return true;
  } catch (err) {
    error(
      `Failed to write ${label} for player ${playerId} to ${filename}`,
      err,
    );
    return false;
  }
}
