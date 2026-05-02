// Standard test batch config factory.
//
// Every e2e spec spins up batches with the same 19-key shape — only
// `batchName` and `treatments` actually vary between specs (and each
// spec randomizes batchName per-test to avoid collisions on disk).
// Centralizing the factory means a future change to batch defaults
// (e.g. a new required key in the schema, a different mock CDN value)
// can be made in one place rather than across every spec file.
//
// Usage:
//   batchConfig({ batchName, treatments: ["solo_1p"] })
//   batchConfig({ batchName, treatments: ["multi_2p_video"], checkVideo: true })
//
// Pass extra keys to override any individual default. Specs that need
// real Daily video, real GitHub repos, etc. spread their overrides on
// top of the defaults.
//
// Coupling: `checkVideo: true` implies `checkAudio: true` (callbacks.js
// at batch init applies the same OR — `checkAudio = (config?.checkAudio
// ?? true) || checkVideo` — so a video-only override is always
// normalized server-side, but pinning the same coupling here keeps the
// returned object self-consistent and matches what researchers see in
// the admin UI).

export function batchConfig({ batchName, treatments, ...overrides }) {
  const merged = {
    batchName,
    // Server's zod schema restricts cdn to "test"/"prod"/"local"; the
    // helper stack injects CDN_TEST_URL so "test" resolves to this
    // worker's mock CDN.
    cdn: "test",
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
    centralPrereg: false,
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
