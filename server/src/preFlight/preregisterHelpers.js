/**
 * Pure helpers that back preregisterSample.
 *
 * Extracted so the pre-registration JSONL contract (sampleId, treatmentHash,
 * exportErrors, etc.) can be unit-tested without mocking the filesystem or
 * GitHub client. The orchestrator in preregister.js wires them up.
 *
 * `condenseBatchConfig` and `collectExportErrors` are shared with the
 * science-data export; both live in `../utils/` so the pre- and post-flight
 * directories depend only on `utils/`, not on each other.
 */
import { createHash } from "crypto";
import { condenseBatchConfig } from "../utils/batchConfig";

// Compact descriptor of the assigned treatment, including a hash of the full
// treatment object so reviewers can confirm that what was pre-registered
// matches what actually ran.
export function buildTreatmentMetadata(treatment) {
  return {
    name: treatment?.name,
    desc: treatment?.desc,
    playerCount: treatment?.playerCount,
    treatmentHash: createHash("sha1")
      .update(JSON.stringify(treatment ?? null))
      .digest("hex"),
  };
}

// Build the serializable pre-registration row. Caller supplies `sampleId`
// (the fresh UUID minted for this player) and any `exportErrors` collected
// from collectExportErrors. The row's shape is a public contract consumed
// by downstream pre-registration analyses.
export function buildPreregData({
  sampleId,
  player,
  batch,
  game,
  exportErrors = [],
}) {
  const participantData = player?.get("participantData") || {};
  const treatment = player?.get("treatment");
  return {
    sampleId,
    deliberationId: participantData.deliberationId,
    batchId: batch?.id,
    timeBatchInitialized: batch?.get("timeInitialized"),
    gameId: game?.id,
    config: condenseBatchConfig(batch?.get("validatedConfig")),
    timeGameStarted: game?.get("timeGameStarted"),
    position: player?.get("position"),
    treatmentMetadata: buildTreatmentMetadata(treatment),
    exportErrors,
  };
}
