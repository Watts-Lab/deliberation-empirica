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

// Resolve a stagebook-referenced asset path to a full URL. Paths in treatment
// files are relative to the treatment file; we join with its directory and
// then prepend the CDN base URL. Returns the input path unchanged when no
// CDN is configured (so consumers can fall back safely during boot).
export function resolveAssetURL(path, { batchConfig, cdnList }) {
  const cdn = batchConfig?.cdn;
  const cdnURL = cdnList?.[cdn] || cdn || cdnList?.prod;
  if (!cdnURL) return path;
  const treatmentFile = batchConfig?.treatmentFile || "";
  const lastSlash = treatmentFile.lastIndexOf("/");
  const treatmentDir = lastSlash >= 0 ? treatmentFile.slice(0, lastSlash) : "";
  const resolved = joinRelativeToDir(treatmentDir, path);
  return encodeURI(`${cdnURL}/${resolved}`);
}
