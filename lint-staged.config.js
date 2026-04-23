// Runs before each commit via .husky/pre-commit.
//
// Scope must match CI's `npm run lint` — otherwise the hook catches
// "errors" CI doesn't, surprising devs. CI currently lints:
//   client/src  cypress  server/src
// playwright/ and orchestrator-spike/ are deliberately out of scope; they
// have never been lint-checked and each carries hundreds of rule
// violations that would require per-dir overrides (no-underscore-dangle
// on __dirname in helpers, import/no-extraneous-dependencies on test
// deps, etc.). Linting those is a separate cleanup PR.
module.exports = {
  "*.{js,jsx,mjs,ts,tsx,json,css,yml,yaml}": ["prettier --write"],
  // ESLint file extensions must match `npm run lint` exactly. CI uses
  // `--ext .js --ext .jsx --ext .mjs`, so no .ts — the repo doesn't have
  // @typescript-eslint/parser configured and the two .ts files
  // (validateBatchConfig.ts, validateDlConfig.ts) would fail parsing.
  "client/src/**/*.{js,jsx,mjs}": ["eslint --fix"],
  "server/src/**/*.{js,jsx,mjs}": ["eslint --fix"],
  "cypress/**/*.{js,jsx,mjs}": ["eslint --fix"],
};
