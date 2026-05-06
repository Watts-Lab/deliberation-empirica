// Server→client globals propagation L3 spec.
//
// Pins three contracts from issue #2's "Globals & server→client
// propagation" bucket. All three exercise the same chain:
//
//   batchConfig (researcher-supplied) → server `setCurrentlyRecruitingBatch`
//   → `ctx.globals.set("recruitingBatchConfig", configWithCdnURL)`
//   → client `useGlobal().get("recruitingBatchConfig")`
//   → downstream rendering / asset resolution
//
// Three distinct observable contracts — each pinned by its own test —
// because a regression at any single layer can break exactly one of
// them while leaving the others working (e.g. cdnURL hydration could
// regress without affecting platformConsent rendering).
//
// 1. `recruitingBatchConfig` reaches the client and shapes the intro
//    sequence: setting `platformConsent: "UK"` server-side must produce
//    UK-specific consent text in the rendered consent page (and the
//    US-only statements must NOT appear). This pins the
//    server→globals→App.jsx→Consent.jsx data-flow chain on a field
//    that's user-visible and easy to reason about.
//
// 2. The CDN URL resolved server-side (hydrated as
//    `recruitingBatchConfig.cdnURL` from `assetBaseUrl`) is what the
//    client actually fetches assets from. Captured by listening to
//    page requests during the walk into the game stage and asserting
//    at least one outbound request landed on the per-worker mock CDN
//    host:port — pinning that the resolved host (not localhost, not a
//    bundle-time constant) is what the runtime uses.
//
// 3. Markdown image URLs in prompt bodies resolve against the same
//    cdnURL: a `![probe](globals_probe.png)` reference in an
//    openResponse prompt body is rewritten by stagebook's Markdown
//    component to an `<img>` whose `src` starts with the CDN host.
//    Pins the StagebookContext `getAssetURL` hook end-to-end —
//    `recruitingBatchConfig.cdnURL` flows into helpers.resolveAssetURL,
//    which stitches it onto the relative path before stagebook's
//    Markdown rewrite. The issue calls these "resourceLookup globals";
//    the actual mechanism in this codebase is `recruitingBatchConfig.cdnURL`,
//    pinned here.
//
// What this catches that lower layers don't:
//   - L1 vitest covers `resolveAssetURL` in isolation against a fake
//     batchConfig — it doesn't observe the server-side hydration step
//     (`configWithCdnURL = { ...config, cdnURL: config.assetBaseUrl }`)
//     or the Empirica `globals.set` → `useGlobal().get` round-trip.
//   - Other solo specs implicitly depend on all three contracts (the
//     intro walk would break, prompts wouldn't fetch, markdown would
//     render unresolved) but don't pin any of them as the load-bearing
//     observation. A regression in cdnURL hydration today would
//     surface as a confusing prompt-render failure in some unrelated
//     spec, not a clear "globals propagation broke" signal.
//
// Notable contracts pinned that are NOT obvious from reading code:
//   - The server hydrates `cdnURL` from `assetBaseUrl` (callbacks.js
//     setCurrentlyRecruitingBatch). A refactor that renamed the field
//     without updating the client read site would silently break
//     asset resolution; tests 2 + 3 catch it.
//   - `platformConsent` defaults to US when unset/missing on the
//     client; explicitly setting "UK" is what differentiates. A
//     regression where `recruitingBatchConfig` arrived empty/missing
//     would silently fall through to US text, masking the failure.
//     Test 1 sets UK and asserts the absence of US-only text as
//     belt-and-braces.

import { test, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

import { launchStack } from "../_helpers/empiricaServer.mjs";
import { installBrowserMocks } from "../_helpers/installBrowserMocks.mjs";
import {
  connectAsAdmin,
  readSrtoken,
  createBatch,
  startBatch,
  stopBatch,
  waitForAttribute,
} from "../_helpers/empiricaAdminAPI.mjs";
import { batchConfig } from "../_helpers/batchConfig.mjs";
import { walkToGame } from "../_helpers/walkParticipant.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(__dirname, "./fixtures");

let stack;
let admin;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({}, testInfo) => {
  stack = await launchStack({
    workerIndex: testInfo.workerIndex,
    fixtureDir,
    logPrefix: "solo-globals",
  });
  admin = await connectAsAdmin({
    tajribaURL: `http://127.0.0.1:${stack.ports.empirica}/query`,
    srtoken: readSrtoken(),
  });
});

test.afterAll(async () => {
  if (stack) await stack.stop();
});

test.beforeEach(async ({ page }) => {
  await installBrowserMocks(page.context());
});

test("recruitingBatchConfig reaches client: platformConsent='UK' renders UK consent items, not US", async ({
  page,
}) => {
  const batchName = `solo_globals_intro_${Date.now()}`;
  const playerKey = `solo_globals_intro_p_${Date.now()}`;

  // platformConsent is read on the client via
  // `globals.get("recruitingBatchConfig")?.platformConsent`. Setting
  // "UK" must select platformConsentUK (which includes the GDPR /
  // UK-DPA statement) and exclude platformConsentUS (which has the
  // "stored indefinitely" statement). If recruitingBatchConfig didn't
  // propagate, Consent.jsx falls back to US (the default branch when
  // platformConsent is undefined or missing) — the US-only text
  // assertion below would then unexpectedly succeed, which is why we
  // assert its absence too.
  const batchId = await createBatch(
    admin,
    batchConfig({
      batchName,
      treatments: ["solo_1p"],
      platformConsent: "UK",
    }),
  );

  try {
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.initialized === true,
      { timeoutMs: 30_000 },
    );
    await startBatch(admin, batchId);
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.status === "running",
      { timeoutMs: 5_000 },
    );

    // Walk through IdForm only — stop AT the consent page (don't click
    // through). Inlined rather than using registerParticipant() because
    // that helper clicks the consent button as its terminal action.
    await page.goto(`${stack.urls.player}?playerKey=${playerKey}`, {
      waitUntil: "load",
    });
    const idInput = page.locator('input[data-testid="inputPaymentId"]');
    await idInput.waitFor({ state: "visible", timeout: 30_000 });
    await idInput.fill(playerKey);
    await page.locator('button[data-testid="joinButton"]').click();

    // Wait for consent page to render. The consent button visible
    // signals all consent items have been rendered.
    await page
      .locator('button[data-testid="consentButton"]')
      .waitFor({ state: "visible", timeout: 30_000 });

    // UK-only statement: complyGDPR_UK contains "Data Protection Act
    // 2018" and "UK General Data Protection Regulation". US consent
    // statements never mention either string.
    await expect(
      page.getByText(/Data Protection Act 2018/),
      "UK-only consent text must render when platformConsent='UK' propagated",
    ).toBeVisible();

    // US-only statement: storeVideoIndefinitely says recordings will
    // be "stored indefinitely". UK substitutes
    // storeVideoUntilPublicationPlusOneYear which says "up to one
    // year after the publication of results". A regression where
    // recruitingBatchConfig didn't propagate (or propagated empty)
    // would default to US and surface this string.
    await expect(
      page.getByText(/stored indefinitely/),
      "US-only consent text must NOT render when platformConsent='UK' propagated — would indicate fall-through to default",
    ).toHaveCount(0);
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
  }
});

test("CDN URL propagates server→client: client fetches prompt assets from the resolved per-worker CDN host", async ({
  page,
}) => {
  const batchName = `solo_globals_cdn_${Date.now()}`;
  const playerKey = `solo_globals_cdn_p_${Date.now()}`;

  const batchId = await createBatch(
    admin,
    batchConfig({ batchName, treatments: ["solo_globals_probe"] }),
  );

  // Capture every outbound request from the page. axios.get from
  // fetchTextContent (helpers.js) issues an XHR for the prompt file,
  // which surfaces here. Set up BEFORE navigation so we don't miss
  // any of the boot-time fetches.
  const cdnHost = `127.0.0.1:${stack.ports.cdn}`;
  const requestUrls = [];
  page.on("request", (req) => {
    requestUrls.push(req.url());
  });

  try {
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.initialized === true,
      { timeoutMs: 30_000 },
    );
    await startBatch(admin, batchId);
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.status === "running",
      { timeoutMs: 5_000 },
    );

    // walkToGame waits on the prompt element to render — that gates
    // on the prompt-file fetch having completed (stagebook's
    // useTextContent → host getTextContent → axios.get(${cdnURL}/...)).
    // If cdnURL didn't propagate, fetchTextContent throws and the
    // prompt never renders → walkToGame would time out with a clear
    // signal rather than this assertion silently passing on the wrong
    // request.
    await walkToGame(page, {
      url: stack.urls.player,
      playerKey,
      gamePromptName: "globalsProbe",
    });

    // Pin: the prompt-file request landed on the per-worker mock CDN
    // host:port — i.e., the runtime used the resolved cdnURL, not a
    // bundle-time constant or the empirica server's own origin.
    // Match by host AND prompt filename so a coincidental request
    // to the same host (e.g. the dev-server's HTML on first load
    // when port stripes overlap) doesn't trip this.
    const promptFetches = requestUrls.filter(
      (u) => u.includes(cdnHost) && u.endsWith("globals_probe.prompt.md"),
    );
    expect(
      promptFetches.length,
      `expected at least one fetch to ${cdnHost}/...globals_probe.prompt.md, got requests: ${requestUrls.filter((u) => u.includes(cdnHost)).join(", ")}`,
    ).toBeGreaterThan(0);
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
  }
});

test("markdown image URL resolution: <img> in prompt body has src resolved against recruitingBatchConfig.cdnURL", async ({
  page,
}) => {
  const batchName = `solo_globals_md_${Date.now()}`;
  const playerKey = `solo_globals_md_p_${Date.now()}`;

  const batchId = await createBatch(
    admin,
    batchConfig({ batchName, treatments: ["solo_globals_probe"] }),
  );

  try {
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.initialized === true,
      { timeoutMs: 30_000 },
    );
    await startBatch(admin, batchId);
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.status === "running",
      { timeoutMs: 5_000 },
    );

    await walkToGame(page, {
      url: stack.urls.player,
      playerKey,
      gamePromptName: "globalsProbe",
    });

    // The fixture body contains `![probe](globals_probe.png)`.
    // Stagebook's Markdown component (rendered inside Prompt) calls
    // `resolveURL(path)` (= host getAssetURL = adapter resolveAssetURL)
    // on the relative path and rewrites the markdown to point at
    // `${cdnURL}/globals_probe.png`. The resulting <img alt="probe">
    // should have its `src` start with the per-worker CDN URL.
    //
    // We don't care whether the image actually loads (the fixture
    // file isn't shipped) — only that the src was resolved. The
    // attribute is set in HTML regardless of fetch success.
    const img = page.locator('img[alt="probe"]');
    await img.waitFor({ state: "attached", timeout: 30_000 });
    const src = await img.getAttribute("src");
    const cdnPrefix = `http://127.0.0.1:${stack.ports.cdn}/`;
    expect(
      src,
      `<img alt="probe" src=…> must start with ${cdnPrefix} (got: ${src})`,
    ).toMatch(
      new RegExp(`^${cdnPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    );
    expect(
      src,
      `<img alt="probe"> src must reference the relative path globals_probe.png after resolution`,
    ).toContain("globals_probe.png");
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
  }
});
