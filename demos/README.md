# Demos

Demonstration studies that exercise the full deliberation-empirica platform end-to-end. Useful for:

- **Manual testing** — drive a flow through the dev server (`npm run start`) and verify behavior visually.
- **Showing the platform off** — to researchers, collaborators, or new contributors who want to see what the platform can do without reading the codebase.
- **As a starting template** — copy and adapt for your own study.

## What's here

### `annotated_demo/`

A two-player cross-partisan-discussion study with:

- A political-affiliation survey in the intro that drives `groupComposition` (Democrats land at position 0, Republicans at position 1)
- An audio + video equipment check
- Conditional templates that swap topic prompts based on URL params or assigned position
- A video-discussion stage
- An exit survey + tracked external-followup link

Every block in `demo.treatments.yaml` is heavily commented, walking through what each construct (`templates`, `introSequences`, `gameStages`, `groupComposition`, conditional rendering, etc.) does. It's the canonical reference for the DSL surface.

## Running it locally

```bash
npm run build      # one-time setup (writes default.env → .env)
npm run start      # starts Empirica + mock CDN serving demos/ on :9091
```

Then in `http://localhost:3000/admin`:

1. Click **New Batch** → **Custom Assignment**
2. Paste the contents of `demos/annotated_demo/dev.config.json` into the config textarea — uses `assetBaseUrl: "http://localhost:9091"` so assets are fetched from the local mock CDN that `npm run start` just spun up. (`demo.config.json` is the same study but points `assetBaseUrl` at the production asset bucket and is intended for deployments where the assets have been uploaded.)
3. Start the batch
4. Open `http://localhost:3000/?playerKey=<any-id>` in two different browsers / private windows

## Related

- [stagebook's `annotated-walkthrough`](https://github.com/deliberation-lab/stagebook/tree/main/examples/annotated-walkthrough) — narrower, focused on stagebook's element DSL in isolation. Useful when you want to see how individual elements behave without the full participant lifecycle around them.
- [Researcher-facing docs](https://deliberation-lab.readthedocs.io/) — the canonical reference for treatment-file syntax, conditions, references, etc.
