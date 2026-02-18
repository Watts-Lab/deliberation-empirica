# Deliberation Lab — Claude Context

Small-group deliberation experiment platform built on [Empirica](https://empirica.ly/). Participants join via a React client; a Node.js server handles game lifecycle, external integrations, and data export.

## Repo Structure

- `client/src/` — React UI: `App.jsx` (intro/exit), `Stage.jsx` (game stages), `elements/` (stage elements), `call/` (Daily video), `components/` (shared UI)
- `server/src/` — Empirica callbacks (`callbacks.js`), `preFlight/` (validation/templating), `postFlight/` (exports), `providers/` (Daily, Qualtrics, Etherpad, GitHub)
- `cypress/e2e/` — End-to-end tests; treat these as the ground truth for expected behavior. Update specs when behavior changes.
- `docs/` — Researcher-facing docs (published to ReadTheDocs)

## Dev Commands

```bash
npm run build      # install deps + copy default.env → .env (run once)
npm run start      # start Empirica server + mock CDN (localhost:3000)
npm run lint       # ESLint (airbnb config) across client/src, server/src, cypress
npm run test       # open Cypress test runner (cd cypress && npx cypress open)
```

Admin UI: `http://localhost:3000/admin`

## Tools

- **GitHub**: Use `gh` CLI for all GitHub workflows — viewing issues, creating PRs, reading and responding to PR review comments. Paste issue/PR URLs or numbers directly into the conversation.
- **Sentry**: Sentry MCP is installed. Use it to fetch error events, look up issues by ID, search for recent errors, etc.

## Key Conventions

- **Tests are spec**: Cypress e2e tests define expected UX and data outputs. Any behavior change requires updating the relevant test.
- **Linting**: ESLint airbnb + prettier. Run `npm run lint` before committing.
- **Environment**: Secrets live in `.env` (gitignored). `default.env` has safe placeholders. External services (Daily video, Qualtrics, Etherpad, GitHub) need real keys in `.env`.
- **State storage**: Empirica state is in `./empirica/local/tajriba.json`. Delete to reset local state.
- **Empirica patterns**: Game state via `game.get()`/`game.set()`, player state via `player.get()`/`player.set()`. Server callbacks in `server/src/callbacks.js`.
