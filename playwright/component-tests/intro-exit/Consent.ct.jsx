import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { Consent } from "../../../client/src/intro-exit/Consent";

/**
 * Component tests for Consent (intro step) — specifically the
 * `consentAddendum` rendering branch.
 *
 * Replaces the `consentAddendum.md` rendering check from cypress 01:107
 * (`cy.get(...).contains("addendum to the standard consent")`).
 * Today there is no CT/unit coverage for the addendum branch.
 *
 * Behaviors under test:
 *
 *   CON-001  When `batchConfig.consentAddendum` is a path, Consent
 *            fetches that file via useText and renders the markdown.
 *   CON-002  When `batchConfig.consentAddendum === "none"`, no fetch
 *            happens and no addendum text appears (just the standard
 *            platform consent items + the "I AGREE" button).
 *   CON-003  When the addendum path is set but the file hasn't loaded
 *            yet, a "Loading Consent Document" placeholder renders
 *            instead of the consent body.
 */

const empiricaConfig = () => ({
  empirica: {
    currentPlayerId: "p0",
    players: [{ id: "p0", attrs: {} }],
    game: { attrs: {} },
    stage: { attrs: {} },
    stageTimer: { elapsed: 0 },
    elapsedTime: 1.5,
  },
});

async function setupGlobals(page, { consentAddendum = "none" } = {}) {
  await page.evaluate(
    (opts) => {
      window.__mockGlobal = {
        get(key) {
          if (key === "recruitingBatchConfig") {
            return {
              cdnURL: "http://localhost:9091",
              platformConsent: "US",
              consentAddendum: opts.consentAddendum,
            };
          }
          return null;
        },
      };
    },
    { consentAddendum },
  );
}

// Stub the IP-geolocation calls Consent's `useConnectionInfo` hook
// makes — they're not relevant to the addendum-rendering branch and
// would otherwise hit the network during tests.
async function stubConnectionInfo(page) {
  await page.route("**/ipwho.is**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        country_code: "US",
        timezone: { id: "America/New_York", utc: "-05:00" },
      }),
    }),
  );
  await page.route("**/lists_vpn/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/plain", body: "" }),
  );
}

test.describe("Consent — addendum branch", () => {
  test.beforeEach(async ({ page }) => {
    await stubConnectionInfo(page);
  });

  test("CON-001: addendum path → fetches file + renders markdown content", async ({
    mount,
    page,
  }) => {
    const addendumMarkdown =
      "## Custom addendum\n\nThis is an addendum to the standard consent.";
    await page.route("**/projects/example/consentAddendum.md", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/markdown",
        body: addendumMarkdown,
      }),
    );

    await setupGlobals(page, {
      consentAddendum: "projects/example/consentAddendum.md",
    });

    const component = await mount(<Consent next={() => {}} />, {
      hooksConfig: empiricaConfig(),
    });

    // The exact phrase cypress 01 was pinning.
    await expect(
      component.getByText("addendum to the standard consent"),
    ).toBeVisible();
    // Standard "I AGREE" button still renders.
    await expect(component.getByTestId("consentButton")).toBeVisible();
  });

  test('CON-002: consentAddendum === "none" → no addendum text rendered', async ({
    mount,
    page,
  }) => {
    let cdnHits = 0;
    // Track whether *any* CDN markdown fetch happens. With "none" the
    // useText path is skipped entirely (consentAddendumPath stays null).
    await page.route("**/projects/example/**.md", (route) => {
      cdnHits += 1;
      route.fulfill({ status: 200, body: "should not be fetched" });
    });

    await setupGlobals(page, { consentAddendum: "none" });

    const component = await mount(<Consent next={() => {}} />, {
      hooksConfig: empiricaConfig(),
    });

    // Standard consent body still renders.
    await expect(component.getByTestId("consentButton")).toBeVisible();
    // No addendum-specific text.
    await expect(
      component.getByText("addendum to the standard consent"),
    ).toHaveCount(0);
    // No outbound .md fetch.
    expect(cdnHits).toBe(0);
  });

  test("CON-003: addendum path set but unresolved → 'Loading Consent Document' placeholder", async ({
    mount,
    page,
  }) => {
    // Hold the addendum fetch open so `useText` never resolves; the
    // component should be in its loading branch.
    let releaseFetch;
    const heldFetch = new Promise((resolve) => {
      releaseFetch = resolve;
    });
    await page.route(
      "**/projects/example/consentAddendum.md",
      async (route) => {
        await heldFetch;
        route.fulfill({ status: 200, contentType: "text/markdown", body: "x" });
      },
    );

    try {
      await setupGlobals(page, {
        consentAddendum: "projects/example/consentAddendum.md",
      });

      const component = await mount(<Consent next={() => {}} />, {
        hooksConfig: empiricaConfig(),
      });

      await expect(
        component.getByText("Loading Consent Document"),
      ).toBeVisible();
      // The "I AGREE" button is NOT visible during the loading phase —
      // pin that the loading branch fully blocks the consent body.
      await expect(component.getByTestId("consentButton")).toHaveCount(0);
    } finally {
      // Always release the held fetch — without try/finally, an
      // assertion failure above would leave the route handler awaiting
      // forever and hang the test runner.
      releaseFetch();
    }
  });
});
