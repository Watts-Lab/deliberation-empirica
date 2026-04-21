/**
 * Pure helpers for per-participant data files.
 *
 * The orchestrator in exportParticipantData.js handles fs I/O (read / create
 * / append the participant JSONL file). The line-format parser and builder
 * live here so the serialization contract can be tested without touching
 * the filesystem.
 */

// Build the meta lines that createNewParticipant writes on first contact.
// Returns an array of JSON-stringified lines (no trailing newline).
export function buildParticipantMetaLines({ platformId, deliberationId, ts }) {
  return [
    JSON.stringify({ type: "meta", key: "platformId", val: platformId, ts }),
    JSON.stringify({
      type: "meta",
      key: "deliberationId",
      val: deliberationId,
      ts,
    }),
  ];
}

// Parse a participantData JSONL blob (as read from disk) into an object
// keyed by the meta field name. Later lines overwrite earlier ones for
// the same key so the most recent update wins.
//
// Non-meta lines (future record types: consent, session, etc.) are
// currently ignored — the orchestrator has a TODO for richer handling.
// We preserve that behavior but make it explicit here. Malformed lines
// are skipped rather than fatal so one bad line doesn't lose the rest
// of a participant's history.
export function parseParticipantData(text) {
  if (typeof text !== "string") return {};
  return text
    .split(/\n/)
    .filter((line) => line.trim() !== "")
    .reduce((acc, line) => {
      try {
        const obj = JSON.parse(line);
        if (obj && obj.type === "meta") {
          acc[obj.key] = obj.val;
        }
      } catch {
        // skip malformed lines
      }
      return acc;
    }, {});
}
