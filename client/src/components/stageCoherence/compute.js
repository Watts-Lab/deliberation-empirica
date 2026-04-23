/**
 * Coherence check for Empirica scopes during the in-game phase.
 *
 * We run with `unmanagedGame: true` on EmpiricaContext so the intro-step flow
 * can render before a game exists. That opts out of Empirica's built-in
 * `useAllReady` gate. This helper is the replacement for that gate, plus an
 * identity check to close a race `useAllReady` doesn't cover.
 *
 * Three race shapes are covered here; see docs/call/videocall-race-notes.md
 * or the split-emit mock for a longer explanation.
 *
 *   Race 2 — fan-out across the top-level scope observables.
 *     One of player/players/game/stage/round is still null while the others
 *     have emitted the new stage's values. The first existence block catches
 *     it.
 *
 *   Race 3 — per-player scope hydration lag.
 *     `ctx.stage` has flipped to stage B but Tajriba hasn't delivered the
 *     PlayerStage-for-B scope yet (or a peer's PlayerStage hasn't arrived).
 *     The second existence block catches it.
 *
 *   Race 1 — mutable ctx vs React state for the Stage scope itself.
 *     `ctx.stage = B` has mutated (so `player.stage` resolves to
 *     PlayerStage-B), but `ret.stage.next(B)` hasn't committed yet
 *     (`useStage()` still returns A). Everything non-null, but
 *     `player.stage.get("stageID") !== useStage()?.id`. The identity block
 *     catches it.
 *
 * Returns `true` when it is safe to read across scopes without risking a
 * torn snapshot. Returns `false` when any scope is missing, any per-player
 * scope has not hydrated, or the stage ids disagree — caller should render
 * a loading sentinel.
 *
 * This module is pure (no React, no Empirica imports) so it can be unit
 * tested with plain objects. The React hook wrapper lives in ./hooks.js.
 */
export function computeStageCoherent({ player, players, game, stage, round }) {
  if (!player || !players || !game || !stage || !round) return false;
  // Self must appear in players. Real Empirica always includes self in the
  // players array once assigned; an empty or self-less players array means
  // the players observable is mid-transition and should not be trusted.
  // Without this guard, `players.some(...)` trivially returns false for an
  // empty array and the gate would report coherent-by-accident.
  if (!players.some((p) => p && p.id === player.id)) return false;
  if (!player.game || !player.round || !player.stage) return false;
  if (players.some((p) => !p.game || !p.round || !p.stage)) return false;

  const stageId = stage.id;
  if (!stageId) return false;
  if (player.stage.get("stageID") !== stageId) return false;
  if (players.some((p) => p.stage.get("stageID") !== stageId)) return false;

  return true;
}

/**
 * Diagnostic variant. Returns `{ coherent, reason, ...context }` so stuck-
 * loading reports can name which sub-check failed. Kept separate from
 * `computeStageCoherent` so the hot path stays a boolean.
 */
export function diagnoseStageCoherent({ player, players, game, stage, round }) {
  if (!player) return { coherent: false, reason: "noPlayer" };
  if (!players) return { coherent: false, reason: "noPlayers" };
  if (!game) return { coherent: false, reason: "noGame" };
  if (!stage) return { coherent: false, reason: "noStage" };
  if (!round) return { coherent: false, reason: "noRound" };
  if (!player.game) return { coherent: false, reason: "noPlayerGame" };
  if (!player.round) return { coherent: false, reason: "noPlayerRound" };
  if (!player.stage) return { coherent: false, reason: "noPlayerStage" };
  const peerMissingScope = players.find((p) => !p.game || !p.round || !p.stage);
  if (peerMissingScope) {
    let reason = "noPeerGame";
    if (!peerMissingScope.round) reason = "noPeerRound";
    if (!peerMissingScope.stage) reason = "noPeerStage";
    return { coherent: false, reason, peerId: peerMissingScope.id };
  }
  const stageId = stage.id;
  if (!stageId) return { coherent: false, reason: "noStageId" };
  if (player.stage.get("stageID") !== stageId) {
    return {
      coherent: false,
      reason: "selfStageIdMismatch",
      selfStageID: player.stage.get("stageID"),
      stageId,
    };
  }
  const peerMismatch = players.find((p) => p.stage.get("stageID") !== stageId);
  if (peerMismatch) {
    return {
      coherent: false,
      reason: "peerStageIdMismatch",
      peerId: peerMismatch.id,
      peerStageID: peerMismatch.stage.get("stageID"),
      stageId,
    };
  }
  return { coherent: true };
}
