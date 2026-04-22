/**
 * Pure helpers that back StagebookProviderAdapter.
 *
 * The adapter itself is a React component that collects Empirica hooks and
 * wraps these helpers in useCallback/useMemo. Extracting the logic here keeps
 * the React surface small and lets us unit-test the translation layer
 * (Empirica <-> StagebookContext) without jsdom.
 *
 * `player`, `game`, and `players[i]` here are expected to implement Empirica's
 * `.get(key)` API. The adapter passes them in directly; tests pass simple
 * objects that expose the same method.
 */

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
            p?.get &&
            Number.parseInt(p.get("position")) === parsedPosition
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

// Pick the CDN base URL to load assets from. Server-supplied globals give us:
//   - `batchConfig.cdn`: either a known key in `cdnList` (e.g. "prod", "test")
//     or a literal URL to use as-is
//   - `cdnList`: map of known CDN keys to URLs, with `prod` as the fallback
// Returns `undefined` during boot when globals haven't arrived yet; callers
// must handle that case (no hard-coded fallback, so we never silently resolve
// against a different origin than the server intends).
export function resolveCdnBaseURL({ batchConfig, cdnList }) {
  const cdn = batchConfig?.cdn;
  return cdnList?.[cdn] || cdn || cdnList?.prod;
}

// Fetch text content referenced from a stagebook treatment. We delegate URL
// resolution to `resolveAssetURL` and always coerce the response to a string,
// because stagebook's `getTextContent` contract is `Promise<string>` — some
// CDNs auto-parse JSON (returning an object), so we JSON-stringify those.
// `fetcher` is the axios-style `get(url) => { data }` function, injected so
// tests can run without making network requests.
export async function fetchTextContent(path, { batchConfig, cdnList, fetcher }) {
  const url = resolveAssetURL(path, { batchConfig, cdnList });
  const { data } = await fetcher(url);
  return typeof data === "string" ? data : JSON.stringify(data);
}

// Assemble the StagebookContext value that the provider exposes. Kept pure so
// the React adapter can wrap it in `useMemo` and so we can unit-test the full
// contract (not just individual helpers). `axiosGet` is injected to keep the
// helper free of network side effects.
export function buildStagebookContextValue({
  player,
  game,
  players,
  progressLabel,
  getElapsedTime,
  setAllowIdle,
  batchConfig,
  cdnList,
  axiosGet,
  renderDiscussion,
  renderSharedNotepad,
  renderSurvey,
}) {
  return {
    get: (key, scope) =>
      getFromEmpiricaState(key, scope, { player, game, players }),
    save: (key, value, scope) =>
      saveToEmpiricaState(key, value, scope, { player, game }),
    getElapsedTime,
    submit: () => player?.stage?.set("submit", true),
    getAssetURL: (path) => resolveAssetURL(path, { batchConfig, cdnList }),
    getTextContent: (path) =>
      fetchTextContent(path, { batchConfig, cdnList, fetcher: axiosGet }),
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

// Resolve a stagebook-referenced asset path to a full URL. Paths in treatment
// files are relative to the treatment file; we join with its directory and
// then prepend the CDN base URL. Returns the input path unchanged when no
// CDN is configured (so consumers can fall back safely during boot).
export function resolveAssetURL(path, { batchConfig, cdnList }) {
  const cdnURL = resolveCdnBaseURL({ batchConfig, cdnList });
  if (!cdnURL) return path;
  const treatmentFile = batchConfig?.treatmentFile || "";
  const lastSlash = treatmentFile.lastIndexOf("/");
  const treatmentDir = lastSlash >= 0 ? treatmentFile.slice(0, lastSlash) : "";
  const resolved = joinRelativeToDir(treatmentDir, path);
  return encodeURI(`${cdnURL}/${resolved}`);
}
