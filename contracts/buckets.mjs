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

/**
 * Per-participant digest the runtime sends in every tick.
 *
 * **Closed-shape contract** (post-manager#262 / dl#187 era). The
 * previous `attrs: Record<string, unknown>` field was an open
 * forwarding slot for Empirica player attributes — bounded by the
 * runtime's `CLASSIFICATION_ATTRS` list but typed as
 * `Record<string, unknown>`, so cost was discipline-dependent
 * rather than contract-enforced. Replaced with typed dashboard-
 * bearing fields the manager (BL-4 / BL-20) actually consumes.
 *
 * Fields:
 *
 * - `id` — BL-20 row identity (participant/recruitment ID).
 * - `bucket` — the eight-state lifecycle classifier (encodes
 *   connected-vs-not).
 * - `treatmentName` — which treatment arm the player is assigned
 *   to. Surfaced from `player.get("treatmentName")`. Optional
 *   (absent pre-assignment).
 * - `gameId` — Empirica "game" identifier (the matched group of
 *   N players). Surfaced from `player.get("gameId")`. Optional
 *   (absent pre-matching).
 * - `lastCompletedAt` — for BL-20's "stuck on stage" vs "still
 *   working" matrix. Surfaced from `player.get("timeComplete")`
 *   (the ISO timestamp the runtime sets on `onPlayerEnd`).
 * - `lastSeenAt` — heartbeat timestamp (BL-20 red/yellow/green
 *   staleness). Optional; reserved for a future per-tick heartbeat
 *   tracker. Not emitted today.
 *
 * Manager treats unknown keys as silently stripped (`.strip()`),
 * so older runtimes that still emit `attrs` parse cleanly on the
 * manager side — but the wire-size win comes from removing the
 * emission, which is what this contract reshapes around.
 */
export const participantDetail = z.object({
  id: z.string().min(1),
  bucket: bucketName,
  treatmentName: z.string().min(1).optional(),
  gameId: z.string().min(1).optional(),
  lastSeenAt: z.string().datetime().optional(),
  lastCompletedAt: z.string().datetime().optional(),
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
