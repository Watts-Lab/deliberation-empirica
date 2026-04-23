/**
 * Pure helpers that back exportPaymentData.
 *
 * The orchestrator in exportPaymentData.js reads from the player/batch,
 * builds the payment row, and writes the JSONL line. Keeping the row
 * builder pure lets us pin the shape contract without mocking fs.
 */

// Return the list of batch-ID consistency errors for a payment row. Payment
// export runs without a `game` scope (it's called per-player at exit time),
// so this is narrower than scienceDataHelpers.collectExportErrors.
export function collectPaymentExportErrors({ player, batch }) {
  const errors = [];
  const batchId = batch?.id;
  if (batchId !== player?.get("batchId")) {
    errors.push(
      `Batch ID: ${batchId} does not match player assigned batch: ${player?.get(
        "batchId"
      )}`
    );
  }
  return errors;
}

// Assemble the JSONL row the payment export writes. URL params are spread
// into the row at the end so any ad-hoc platform parameters (workerId,
// assignmentId, etc.) flow through automatically.
export function buildPaymentData({ player, batch, exportErrors = [] }) {
  const batchId = batch?.id;
  const batchConfig = batch?.get("validatedConfig");
  const participantData = player?.get("participantData") || {};
  return {
    batchId,
    batchName: batchConfig?.batchName,
    platformId: participantData.platformId,
    introDone: player?.get("introDone"),
    timeIntroDone: player?.get("timeIntroDone"),
    exitStatus: player?.get("exitStatus"),
    connectionInfo: player?.get("connectionInfo"),
    exportErrors,
    ...(player?.get("urlParams") || {}),
  };
}
