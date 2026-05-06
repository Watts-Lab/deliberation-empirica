// Standard test batch config factory.
//
// Every e2e spec spins up batches with the same shape — only `batchName`
// and `treatments` actually vary between specs (and each spec randomizes
// batchName per-test to avoid collisions on disk). Centralizing the
// factory means a future change to batch defaults (e.g. a new required
// key in the schema, a different mock CDN value) can be made in one
// place rather than across every spec file.
//
// Usage:
//   batchConfig({ batchName, treatments: ["solo_1p"] })
//   batchConfig({ batchName, treatments: ["multi_2p_video"], checkVideo: true })
//
// Pass extra keys to override any individual default. Specs that need
// real Daily video, real GitHub repos, etc. spread their overrides on
// top of the defaults.
//
// `setTestAssetBaseUrl(url)` is called by empiricaServer.launchStack
// before specs run so each worker's batchConfig() picks up the worker-
// specific mock-CDN URL via assetBaseUrl. Schema requires it be a
// non-trailing-slash URL; the helper strips a trailing slash if present.
//
// Coupling: `checkVideo: true` implies `checkAudio: true` (callbacks.js
// at batch init applies the same OR — `checkAudio = (config?.checkAudio
// ?? true) || checkVideo` — so a video-only override is always
// normalized server-side, but pinning the same coupling here keeps the
// returned object self-consistent and matches what researchers see in
// the admin UI).

let TEST_ASSET_BASE_URL = null;

export function setTestAssetBaseUrl(url) {
  TEST_ASSET_BASE_URL = url ? url.replace(/\/$/, "") : null;
}

export function batchConfig({ batchName, treatments, ...overrides }) {
  if (!TEST_ASSET_BASE_URL && !("assetBaseUrl" in overrides)) {
    throw new Error(
      "batchConfig: TEST_ASSET_BASE_URL not set — call setTestAssetBaseUrl(url) from launchStack first, or pass assetBaseUrl explicitly.",
    );
  }
  const merged = {
    batchName,
    assetBaseUrl: TEST_ASSET_BASE_URL,
    // Deterministic 40-hex SHA so scienceData/preregistration exports
    // round-trip a real-shaped value. Without this, the runtime stamps
    // the "unknown" sentinel (since solo-dev mode no longer falls back
    // to a live GitHub-API head-sha lookup) — fine in production but
    // breaks specs that pin the field shape.
    assetsRepoSha: "deadbeef00000000000000000000000000000000",
    treatmentFile: "study.treatments.yaml",
    customIdInstructions: "none",
    platformConsent: "US",
    consentAddendum: "none",
    debrief: "none",
    checkAudio: false,
    checkVideo: false,
    introSequence: "none",
    treatments,
    payoffs: "equal",
    knockdowns: "none",
    dispatchWait: 1,
    launchDate: "immediate",
    preregRepos: [],
    dataRepos: [],
    videoStorage: "none",
    exitCodes: "none",
    ...overrides,
  };
  if (merged.checkVideo && !merged.checkAudio) {
    merged.checkAudio = true;
  }
  return merged;
}
