import { error, info } from "@empirica/core/console";
import { summarizePlayerProgression } from "../state/summarizePlayerProgression.mjs";

// Periodic operator-facing log of player counts by progression bucket.
// Bucket classification is shared with the manager's tick-channel
// summarizer (server/src/state/summarizePlayerProgression.mjs) so the
// two surfaces can't drift on the definition of "in lobby" / "in
// game" / etc. — both come from `classifyPlayer()` exactly once via
// the summarizer.
//
// What this function adds on top of the bare summarizer: per-source
// breakdowns for the intro / countdown / lobby buckets, derived from
// each player's `entryUrl.params.source` (which the summarizer
// deliberately doesn't surface, since it's logging context, not
// participant state the manager needs to render). We zip the
// summarizer's `details` array with the in-process player scopes —
// each detail carries the bucket the summarizer assigned, so the
// per-source tally just keys off that bucket name without
// re-implementing the classification chain.
export function logPlayerCounts(ctx) {
  try {
    const { buckets, details } = summarizePlayerProgression(ctx);

    const players = ctx.scopesByKind("player");
    const detailsById = new Map(details.map((d) => [d.id, d]));
    const introSources = {};
    const countdownSources = {};
    const lobbySources = {};
    players.forEach((player) => {
      const detail = detailsById.get(player.id);
      if (!detail) return;
      const source = player.get("entryUrl")?.params?.source || "unknown";
      if (detail.bucket === "inLobby") {
        lobbySources[source] = (lobbySources[source] || 0) + 1;
      } else if (detail.bucket === "inCountdown") {
        countdownSources[source] = (countdownSources[source] || 0) + 1;
      } else if (detail.bucket === "inIntro") {
        introSources[source] = (introSources[source] || 0) + 1;
      }
    });

    info(
      `== ${buckets.inIntro} in intro steps, ${buckets.inCountdown} in countdown, ${buckets.inLobby} in lobby, ${buckets.inGame} in games, ${buckets.inExitSequence} in exit sequence, ${buckets.completed} completed, ${buckets.disconnected} disconnected incomplete, ${buckets.unknown} unknown`,
    );
    info("== Intro Sources:", introSources);
    info("== Countdown Sources:", countdownSources);
    info("== Lobby Sources:", lobbySources);
  } catch (e) {
    error("Caught error in logPlayerCounts:", e);
  }
}
