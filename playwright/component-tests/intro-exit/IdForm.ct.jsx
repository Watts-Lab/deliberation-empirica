import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { IdForm } from "../../../client/src/intro-exit/IdForm";

/**
 * Component tests for IdForm — the `customIdInstructions` adapter
 * branches.
 *
 * Replaces cypress 01:90-101: when `customIdInstructions` is an object
 * keyed by URL params, a matching `?key=value` URL prefills the
 * `inputPaymentId` field AND fetches the matching custom-instructions
 * markdown file. Falls back to the `default` entry when no URL param
 * matches.
 *
 * Idea-level coverage of `validateId` lives in `idValidation.test.js`
 * (12 vitests, PR #54). This file is specifically about the URL-param
 * → ID prefill + custom-instructions routing.
 *
 * Behaviors under test:
 *
 *   IF-001  customIdInstructions = { MyId: "...", default: "..." }
 *           with `?MyId=dummy` → field has value "dummy" + custom
 *           instructions markdown content renders
 *   IF-002  customIdInstructions = { MyId: "...", default: "..." }
 *           with no matching URL param → no prefill + default
 *           instructions markdown content renders
 *   IF-003  customIdInstructions as a literal string path → that
 *           file's markdown renders (no URL-param logic)
 *   IF-004  customIdInstructions === "none" → built-in fallback
 *           headline shows ("Please enter the identifier assigned by
 *           your recruitment platform.")
 *
 * The PreIdChecks gate is bypassed in all tests by configuring the
 * batch with `checkVideo: false`/`checkAudio: false` — IdForm's
 * useEffect then sets `checksPassed=true` synchronously.
 */

const empiricaConfig = () => ({
  empirica: {
    currentPlayerId: "p0",
    players: [{ id: "p0", attrs: {} }],
    game: { attrs: {} },
    stage: { attrs: {} },
    stageTimer: { elapsed: 0 },
  },
});

async function setupGlobals(page, batchConfig) {
  await page.evaluate((config) => {
    window.__mockGlobal = {
      get(key) {
        if (key === "recruitingBatchConfig") return config;
        return null;
      },
    };
  }, batchConfig);
}

// Drive the URL params the IdForm reads via window.location.search.
// `useMemo` snapshots them on first mount, so the navigation has to
// happen *before* the mount call.
async function setUrlParams(page, params) {
  await page.evaluate((p) => {
    const qs = new URLSearchParams(p).toString();
    // Pushing state changes location.search without reloading the page.
    window.history.replaceState({}, "", `?${qs}`);
  }, params);
}

test.describe("IdForm — customIdInstructions adapter", () => {
  test("IF-001: object form + matching URL param → prefill + custom file rendered", async ({
    mount,
    page,
  }) => {
    const customMarkdown =
      "# My-Id Instructions\n\nthisIsMyCustomCodeInstruction for the test.";
    await page.route("**/projects/example/customIdInstructions.md", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/markdown",
        body: customMarkdown,
      }),
    );

    await setUrlParams(page, { MyId: "dummy" });
    await setupGlobals(page, {
      cdnURL: "http://localhost:9091",
      checkVideo: false,
      checkAudio: false,
      customIdInstructions: {
        MyId: "projects/example/customIdInstructions.md",
        default: "projects/example/defaultIdInstructions.md",
      },
    });

    const component = await mount(<IdForm onPlayerID={() => {}} />, {
      hooksConfig: empiricaConfig(),
    });

    // Custom instructions text rendered.
    await expect(
      component.getByText("thisIsMyCustomCodeInstruction for the test."),
    ).toBeVisible();
    // ID input prefilled with the URL param value.
    await expect(component.getByTestId("inputPaymentId")).toHaveValue("dummy");
    // Default-instructions markdown should NOT render — only one of
    // the two should be selected per route.
    await expect(component.getByText("default instructions")).toHaveCount(0);
  });

  test("IF-002: object form + NO matching URL param → default file rendered, no prefill", async ({
    mount,
    page,
  }) => {
    const defaultMarkdown =
      "# Default Instructions\n\nThe default instructions message.";
    await page.route("**/projects/example/defaultIdInstructions.md", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/markdown",
        body: defaultMarkdown,
      }),
    );

    await setUrlParams(page, { unrelatedKey: "x" });
    await setupGlobals(page, {
      cdnURL: "http://localhost:9091",
      checkVideo: false,
      checkAudio: false,
      customIdInstructions: {
        MyId: "projects/example/customIdInstructions.md",
        default: "projects/example/defaultIdInstructions.md",
      },
    });

    const component = await mount(<IdForm onPlayerID={() => {}} />, {
      hooksConfig: empiricaConfig(),
    });

    await expect(
      component.getByText("The default instructions message."),
    ).toBeVisible();
    // No prefill — input should be empty.
    await expect(component.getByTestId("inputPaymentId")).toHaveValue("");
  });

  test("IF-003: customIdInstructions as a literal string path → that file rendered", async ({
    mount,
    page,
  }) => {
    await page.route("**/projects/example/onlyOne.md", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/markdown",
        body: "# Single instructions\n\nstringPathOnlyContent",
      }),
    );

    await setupGlobals(page, {
      cdnURL: "http://localhost:9091",
      checkVideo: false,
      checkAudio: false,
      customIdInstructions: "projects/example/onlyOne.md",
    });

    const component = await mount(<IdForm onPlayerID={() => {}} />, {
      hooksConfig: empiricaConfig(),
    });

    await expect(component.getByText("stringPathOnlyContent")).toBeVisible();
  });

  test('IF-004: customIdInstructions === "none" → built-in fallback headline shown', async ({
    mount,
    page,
  }) => {
    await setupGlobals(page, {
      cdnURL: "http://localhost:9091",
      checkVideo: false,
      checkAudio: false,
      customIdInstructions: "none",
    });

    const component = await mount(<IdForm onPlayerID={() => {}} />, {
      hooksConfig: empiricaConfig(),
    });

    await expect(
      component.getByText(
        "Please enter the identifier assigned by your recruitment platform.",
      ),
    ).toBeVisible();
  });
});
