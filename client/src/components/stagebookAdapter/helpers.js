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
// we actually store on the player. Unlike `browserInfo` / `entryUrl` /
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

// Implements stagebook's `getAssetURL(path)` host hook. Stagebook's
// spec (see node_modules/stagebook source: HIERARCHICAL_URL_RE +
// urlSchema's "URL must use http://, https://, or asset:// ..."
// message) defines exactly three forms:
//
//  1. `asset://X` (case-insensitive scheme) — platform-provided
//     asset whose path is prefix-root-relative. Strip the scheme
//     and join: `${cdnURL}/X`.
//
//  2. `http(s)://...` — external URL. Pass through unchanged.
//     (Protocol-relative `//host/path` also passes — it's
//     conventionally http/https at fetch time.)
//
//  3. Naked relative path — repo-bundled asset referenced from a
//     treatment file. Stagebook's contract is "paths in treatment
//     files are relative to the treatment file's location," so we
//     join with the treatment's directory before prepending the
//     prefix.
//
// Other URL schemes (`data:`, `file:`, `mailto:`, etc.) are NOT
// part of stagebook's spec — its `urlSchema` rejects them at
// validation time before they ever reach this resolver. We
// explicitly reject them here too as defense-in-depth so a typo or
// bypass surfaces as a clear error rather than a silent pass-through
// fetch.
//
// `cdnURL` is the asset-resolution prefix the server hydrated into
// `batchConfig.cdnURL` — the resolved CDN-enum URL in solo-dev mode,
// or the per-Study mirrored S3 prefix in manager-launched mode
// (per ADR 0009). The client treats both identically.
//
// Returns the input path unchanged when batchConfig hasn't arrived
// yet, so consumers can fall back safely during boot.
const ASSET_SCHEME_RE = /^asset:\/\//i;
const MALFORMED_ASSET_SCHEME_RE = /^asset:/i;
const HTTP_URL_RE = /^(?:https?:)?\/\//i;
const ANY_URL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

export function resolveAssetURL(path, { batchConfig }) {
  const cdnURL = batchConfig?.cdnURL;
  if (!cdnURL) return path;

  if (ASSET_SCHEME_RE.test(path)) {
    return encodeURI(`${cdnURL}/${path.replace(ASSET_SCHEME_RE, "")}`);
  }
  // Catch malformed `asset:` references (e.g. `asset:foo`,
  // `asset:/foo`) before they fall through. Without this guard a
  // typo would silently become an opaque browser fetch failure
  // later instead of a clear validation error per stagebook's spec.
  if (MALFORMED_ASSET_SCHEME_RE.test(path)) {
    throw new Error(
      `Malformed asset reference "${path}" — the asset: scheme requires "//" (use "asset://${path.replace(MALFORMED_ASSET_SCHEME_RE, "")}")`,
    );
  }
  if (HTTP_URL_RE.test(path)) {
    return path;
  }
  // Any other URL scheme is out-of-spec for stagebook. Reject
  // explicitly rather than passing through — stagebook's own
  // validation already rejects these upstream, but a defensive
  // check here catches programmatic insertions or cross-version
  // drift.
  if (ANY_URL_SCHEME_RE.test(path)) {
    throw new Error(
      `Unsupported URL scheme in "${path}" — stagebook accepts only http(s):// and asset:// references (per stagebook urlSchema spec).`,
    );
  }

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
