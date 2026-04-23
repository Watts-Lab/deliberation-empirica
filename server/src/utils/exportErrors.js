/**
 * Cross-cutting consistency checks attached to every exported JSONL row.
 *
 * Shared between the pre-registration export (preFlight/preregister) and the
 * science-data export (postFlight/exportScienceData). Returned error strings
 * are serialized into the row's `exportErrors` field so discrepancies are
 * visible in the data rather than swallowed.
 */

export function collectExportErrors({ player, batch, game }) {
  const errors = [];
  const batchId = batch?.id;
  const gameId = game?.id;
  if (batchId !== player?.get("batchId")) {
    errors.push(
      `Batch ID: ${batchId} does not match player assigned batch: ${player?.get(
        "batchId",
      )}`,
    );
  }
  if (gameId !== player?.get("gameId")) {
    errors.push(
      `Game ID ${gameId} does not match player assigned game ${player?.get(
        "gameId",
      )}`,
    );
  }
  return errors;
}
