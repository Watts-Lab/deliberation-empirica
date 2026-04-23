/**
 * Pure helpers that back StagebookProviderAdapter.
 *
 * The adapter itself is a React component that collects Empirica hooks and
 * wraps these helpers in useMemo. Extracting the logic here keeps the React
 * surface small and lets us unit-test the translation layer
 * (Empirica <-> StagebookContext) without jsdom.
 *
 * `player`, `game`, and `players[i]` here are expected to implement Empirica's
 * `.get(key)` API. The adapter passes them in directly; tests pass simple
 * objects that expose the same method.
 */

import axios from "axios";

// Join `filePath` relative to `dir`, collapsing `.`/`..` and empty segments.
// Paths in stagebook treatment files are relative to the treatment file's
// location; this is the one place where that resolution lives on the client.
export function joinRelativeToDir(dir, filePath) {
  if (filePath == null) return "";
  const combined = dir ? `${dir}/${filePath}` : filePath;
  const segments = combined.split("/").reduce((acc, seg) => {
    if (seg === "" || seg === ".") return acc;
    if (seg === "..") {
      acc.pop();
      return acc;
    }
    acc.push(seg);
    return acc;
  }, []);
  return segments.join("/");
}

// Synthesize stagebook's `participantInfo` namespace from the flat attributes
// we actually store on the player. Unlike `browserInfo` / `urlParams` /
// `connectionInfo` (which Consent.jsx writes atomically as one object), the
// components of `participantInfo` arrive from three different actors at
// three different times:
//   - deliberationId  →  server callback on connect (via `participantData`)
//   - name            →  client EnterNickname after intro
//   - sampleId        →  server preregister on game start
// Storing them as a single nested object would require coordinated dual-
// writes in three places with real drift risk, so we keep the flat attrs as
// the source of truth and synthesize the namespace at read time here. Any
// future field goes the same way: write flat, add one line below.
function synthesizeParticipantInfo(p) {
  if (!p?.get) return undefined;
  const participantData = p.get("participantData") || {};
  return {
    name: p.get("name"),
    sampleId: p.get("sampleId"),
    deliberationId: participantData.deliberationId,
  };
}

// Translate stagebook's scope-based `get(key, scope)` to Empirica's per-player
// / game state model. Scopes (from stagebook docs):
//   undefined or "player" → current participant's state (one value)
//   "shared"              → shared/game state (one value)
//   "all"                 → array with one value per participant
//   "0", "1", ...         → specific participant(s) by position index
// Stagebook normalizes "any" and "percentAgreement" to "all" before calling
// get, so we don't need to handle those here — but we return safely anyway
// if something unexpected comes through.
export function getFromEmpiricaState(key, scope, { player, game, players }) {
  // `participantInfo` is always per-player, even when the scope is "shared"
  // (there's no game-level participant info). Route every scope through the
  // synthesize function against the right player(s).
  if (key === "participantInfo") {
    if (scope === "all") {
      return (players || []).map(synthesizeParticipantInfo);
    }
    if (scope !== undefined && scope !== "player" && scope !== "shared") {
      const parsedPosition = Number.parseInt(scope);
      if (!Number.isNaN(parsedPosition)) {
        return (players || [])
          .filter(
            (p) =>
              p?.get && Number.parseInt(p.get("position")) === parsedPosition,
          )
          .map(synthesizeParticipantInfo);
      }
    }
    return [synthesizeParticipantInfo(player)];
  }

  if (scope === "shared") {
    return [game?.get ? game.get(key) : undefined];
  }
  if (scope === "all") {
    return (players || []).map((p) => (p?.get ? p.get(key) : undefined));
  }
  if (scope !== undefined && scope !== "player") {
    const parsedPosition = Number.parseInt(scope);
    if (!Number.isNaN(parsedPosition)) {
      return (players || [])
        .filter(
          (p) =>
            p?.get && Number.parseInt(p.get("position")) === parsedPosition,
        )
        .map((p) => p.get(key));
    }
  }
  return [player?.get ? player.get(key) : undefined];
}

// Route saves to the correct Empirica scope. Stagebook passes "player" (or
// undefined) for per-participant data and "shared" for group-shared data.
export function saveToEmpiricaState(key, value, scope, { player, game }) {
  if (scope === "shared") {
    if (!game?.set) return;
    game.set(key, value);
    return;
  }
  if (!player?.set) return;
  player.set(key, value);
}

// Resolve a stagebook-referenced asset path to a full URL. Paths in treatment
// files are relative to the treatment file; we join with its directory and
// then prepend the CDN base URL the server hydrated into `batchConfig.cdnURL`.
// Returns the input path unchanged when batchConfig hasn't arrived yet, so
// consumers can fall back safely during boot.
export function resolveAssetURL(path, { batchConfig }) {
  const cdnURL = batchConfig?.cdnURL;
  if (!cdnURL) return path;
  const treatmentFile = batchConfig?.treatmentFile || "";
  const lastSlash = treatmentFile.lastIndexOf("/");
  const treatmentDir = lastSlash >= 0 ? treatmentFile.slice(0, lastSlash) : "";
  const resolved = joinRelativeToDir(treatmentDir, path);
  return encodeURI(`${cdnURL}/${resolved}`);
}

// Fetch text content referenced from a stagebook treatment. Delegates URL
// resolution to `resolveAssetURL` and always coerces the response to a string,
// because stagebook's `getTextContent` contract is `Promise<string>` — some
// CDNs auto-parse JSON (returning an object), so we JSON-stringify those.
//
// Fails loudly if `batchConfig` hasn't arrived yet instead of quietly fetching
// a relative URL from our own origin (which returns the dev-server HTML and
// makes stagebook's parser report misleading "must have three sections"
// errors). Callers pair this with a `contentVersion` bump when batchConfig
// lands, so stagebook re-fetches once the real URL can be resolved.
export async function fetchTextContent(path, { batchConfig }) {
  if (!batchConfig?.cdnURL) {
    throw new Error(
      "Cannot fetch text content: recruitingBatchConfig.cdnURL not loaded yet",
    );
  }
  const url = resolveAssetURL(path, { batchConfig });
  const { data } = await axios.get(url);
  return typeof data === "string" ? data : JSON.stringify(data);
}

// Assemble the StagebookContext value that the provider exposes. Kept pure so
// the React adapter can wrap it in `useMemo` and so we can unit-test the full
// contract (not just individual helpers).
export function buildStagebookContextValue({
  player,
  game,
  players,
  progressLabel,
  getElapsedTime,
  setAllowIdle,
  batchConfig,
  renderDiscussion,
  renderSharedNotepad,
  renderSurvey,
}) {
  // Bumps from 0 → 1 once batchConfig arrives, so stagebook's useTextContent
  // re-fetches any prompts whose first fetch happened before the CDN URL was
  // available. Without this, a stage mounted before batchConfig arrives would
  // show a stale "Error parsing prompt" indefinitely.
  const contentVersion = batchConfig?.cdnURL ? 1 : 0;

  return {
    get: (key, scope) =>
      getFromEmpiricaState(key, scope, { player, game, players }),
    save: (key, value, scope) =>
      saveToEmpiricaState(key, value, scope, { player, game }),
    getElapsedTime,
    submit: () => player?.stage?.set("submit", true),
    getAssetURL: (path) => resolveAssetURL(path, { batchConfig }),
    getTextContent: (path) => fetchTextContent(path, { batchConfig }),
    contentVersion,
    progressLabel,
    playerId: player?.id,
    position: player?.get ? player.get("position") : undefined,
    playerCount: players?.length,
    isSubmitted: !!player?.stage?.get?.("submit"),
    setAllowIdle,
    renderDiscussion,
    renderSharedNotepad,
    renderSurvey,
  };
}
