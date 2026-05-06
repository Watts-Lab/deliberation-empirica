import { z } from "zod";

/**
 * Participant-progression buckets — the runtime's classification of every
 * connected participant into one of eight states. The classifier lives at
 * `server/src/state/summarizePlayerProgression.mjs`; both the operator
 * log line (`server/src/utils/logging.js logPlayerCounts`) and the
 * Playwright test helper (`playwright/e2e/_helpers/empiricaAdminAPI.mjs
 * summarizePlayerProgression`) delegate to it, so all three consumers
 * key on the same definitions of "in lobby" / "in game" / etc.
 *
 * The manager's dashboard uses these counts directly (BL-4 aggregate
 * header) and the per-participant `bucket` field for the live table
 * (BL-20). Bucket names are stable identifiers, not display strings —
 * the manager renders them via its own i18n.
 */
export const BUCKETS = [
  "completed",
  "inExitSequence",
  "inGame",
  "inLobby",
  "inCountdown",
  "inIntro",
  "disconnected",
  "unknown",
];

export const bucketName = z.enum([...BUCKETS]);

export const bucketCounts = z.object({
  completed: z.number().int().nonnegative(),
  inExitSequence: z.number().int().nonnegative(),
  inGame: z.number().int().nonnegative(),
  inLobby: z.number().int().nonnegative(),
  inCountdown: z.number().int().nonnegative(),
  inIntro: z.number().int().nonnegative(),
  disconnected: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
});

export const participantDetail = z.object({
  id: z.string().min(1),
  bucket: bucketName,
  attrs: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Every field is optional so the schema accepts both the shapes the
 * runtime emits during the migration:
 *
 * - **Pre-#73 (count-only ticks)**: `{ count: 5 }`. The runtime's
 *   tick scheduler (deliberation-lab#11) ships first; only `count` is
 *   computed at that point.
 * - **summarizePlayerProgression output (#73 source helper)**:
 *   `{ buckets, details }` — the existing playwright helper returns
 *   exactly this shape and #73 explicitly requires the shape stay
 *   stable when it moves into production.
 * - **Post-#73, fully wired**: `{ count, buckets, details }` — the
 *   tick scheduler enriches the helper's output with `count` derived
 *   from buckets sum.
 *
 * All three shapes validate. Tightening to require any field breaks
 * one of the migration steps.
 */
export const participantProgression = z.object({
  count: z.number().int().nonnegative().optional(),
  buckets: bucketCounts.optional(),
  details: z.array(participantDetail).optional(),
});
