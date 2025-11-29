# Deliberation Lab

Deliberation Lab runs small-group experiments with live video/text discussions, prompts/surveys, and rich data exports for research on deliberation and collective reasoning. Full researcher docs are published at https://deliberation-lab.readthedocs.io/en/latest/ — start there for study design, batch configuration, and analysis guides.

## Repo Overview (for developers)

- `client/` — React client shown to participants: intro/exit flows, game stages/elements, discussion UI (Daily video, text chat), shared UI components. See `client/src/README.md` and subfolder READMEs.
- `server/` — Empirica server callbacks, dispatch, validation, providers (Daily, GitHub, Qualtrics, Etherpad), exports/postflight. See `server/src/README.md` and subfolder READMEs.
- `cypress/` — End-to-end tests plus mock CDN assets; acts as executable specification for expected behavior. See `cypress/README.md`.
- `data/` — Gitignored scratch space for local science/prereg/payment/postflight files, logs (`empirica.log`), and Tajriba state (`tajriba.json`).
- `docs/` — Markdown docs for researchers (published to ReadTheDocs) and technical references (analysis, syntax).
- Other: `.github/` workflows, `Dockerfile`/`entrypoint.sh` for packaging, `runner.sh` dev script.

## Getting Started (dev)

Prereqs: Node.js, npm, and optionally Docker (for local Etherpad). Empirica CLI is auto-installed by the build.

1. Install and seed env:

```bash
npm run build
```

This installs dependencies (client+server), installs Empirica CLI if needed, and copies `default.env` to `.env` (edit `.env` with real secrets before hitting external services).

2. (Optional) start local Etherpad if needed:

```bash
npm run start:etherpad
```

3. Start dev stack (Empirica server + mock CDN):

```bash
npm run start
```

Visit `http://localhost:3000/admin` to create a batch and `http://localhost:3000` for participant view.

### Environment

`.env` holds API keys and repo info (Daily, Qualtrics, Etherpad, GitHub, admin PW, data repo targets, etc.). `default.env` provides safe placeholders for local demos.

### Repo structure tips

- Client entry: `client/src/App.jsx` (intro/exit) and `client/src/Stage.jsx` (game stages). Elements live under `client/src/elements/`.
- Server entry: `server/src/index.js` uses `callbacks.js` for all lifecycle events.
- Validations/templating: `server/src/preFlight/`.
- Exports/postflight: `server/src/postFlight/`.
- Providers: `server/src/providers/`.
- Tests: `cypress/e2e/*.js` scenarios; fixtures under `cypress/fixtures/`.

When behavior changes, update both code and Cypress specs; tests are the ground truth for expected UX and data outputs.

## Code StyleCheck and Basic Debugging

This project uses Eslint to enforce coding style and automatically debug certain issues.

If not installed already, first [install](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) the ESLint VSCode extension.

Next, to install the relevant dependencies and enable linting in your local development environment, run the command `npm run lint` in a terminal opened at the root directory. The terminal will then display a list of current errors, if there are any.

You do not need to run this command again so long as the dependencies are still installed locally. Any files containing errors will red in the VSCode Explorer, and the code causing the errors underlined.

## Troubleshooting:

Empirica stores session data in `./empirica/local/tajriba.json`.
If there is an issue where empirica's data gets corrupted, you can clear the working database
by deleting this file. Empricia will start with a fresh slate, and rebuild the file based on
actions you take from then on.
