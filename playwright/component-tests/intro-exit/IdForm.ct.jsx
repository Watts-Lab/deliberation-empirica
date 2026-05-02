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

/**
 * Component tests for IdForm — input → validation → submit-button bindings.
 *
 * The pure-function rules in `validateId` are exhaustively tested at L1
 * in `client/src/intro-exit/idValidation.test.js`. These L2 tests pin
 * the bindings between those rule outputs and the rendered UI inside
 * `PlayerIdEntry`:
 *
 *   - `disabled={!playerIDValid}` on the Join button
 *   - `<p className="text-red-600 text-sm italic">{errMsg}</p>` for the
 *     error message
 *   - `setPlayerIDValid` / `setErrMsg` fire on every onChange — i.e.
 *     they update reactively, not just on first render
 *   - `handleSubmit` early-returns when `!playerIDValid`, so the click
 *     handler is a no-op while disabled
 *   - On a valid + clicked submit, `onPlayerID(playerID)` (the trimmed
 *     value) fires exactly once
 *
 * All these tests use `customIdInstructions: "none"` so the default
 * built-in headline shows and no CDN fetch is needed.
 */

test.describe("IdForm — input → validation → submit bindings", () => {
  test("IF-005: empty input → button disabled, no error message visible", async ({
    mount,
    page,
  }) => {
    // Initial-state binding: with no input typed yet, validateId("")
    // returns errors=[...] BUT errMsg is still "" (initial useState
    // value), so no <p> text shows. The Join button is disabled because
    // playerIDValid starts as false.
    await setupGlobals(page, {
      cdnURL: "http://localhost:9091",
      checkVideo: false,
      checkAudio: false,
      customIdInstructions: "none",
    });

    const component = await mount(<IdForm onPlayerID={() => {}} />, {
      hooksConfig: empiricaConfig(),
    });

    await expect(component.getByTestId("inputPaymentId")).toHaveValue("");
    await expect(component.getByTestId("joinButton")).toBeDisabled();
    // No error message text in the red <p> on initial render.
    await expect(
      component.getByText("Please enter at least 2 characters"),
    ).toHaveCount(0);
    await expect(component.getByText("invalid characters")).toHaveCount(0);
  });

  test("IF-006: 1-character input → 'at least 2 characters' message + button disabled", async ({
    mount,
    page,
  }) => {
    // Pins the length-rule → errMsg → disabled-button binding chain.
    await setupGlobals(page, {
      cdnURL: "http://localhost:9091",
      checkVideo: false,
      checkAudio: false,
      customIdInstructions: "none",
    });

    const component = await mount(<IdForm onPlayerID={() => {}} />, {
      hooksConfig: empiricaConfig(),
    });

    await component.getByTestId("inputPaymentId").fill("a");

    await expect(
      component.getByText("Please enter at least 2 characters"),
    ).toBeVisible();
    await expect(component.getByTestId("joinButton")).toBeDisabled();
  });

  test("IF-007: invalid characters → 'invalid characters' message + button disabled", async ({
    mount,
    page,
  }) => {
    // Pins the invalid-chars-rule → errMsg → disabled-button binding,
    // using the same string the L1 idValidation.test.js corpus uses.
    await setupGlobals(page, {
      cdnURL: "http://localhost:9091",
      checkVideo: false,
      checkAudio: false,
      customIdInstructions: "none",
    });

    const component = await mount(<IdForm onPlayerID={() => {}} />, {
      hooksConfig: empiricaConfig(),
    });

    await component.getByTestId("inputPaymentId").fill("InvalidChars_#!*&");

    await expect(component.getByText(/invalid characters/)).toBeVisible();
    await expect(component.getByTestId("joinButton")).toBeDisabled();
  });

  test("IF-008: 65-character input → 'no more than 64 characters' message + button disabled", async ({
    mount,
    page,
  }) => {
    // Pins the max-length rule → errMsg → disabled-button binding.
    await setupGlobals(page, {
      cdnURL: "http://localhost:9091",
      checkVideo: false,
      checkAudio: false,
      customIdInstructions: "none",
    });

    const component = await mount(<IdForm onPlayerID={() => {}} />, {
      hooksConfig: empiricaConfig(),
    });

    await component.getByTestId("inputPaymentId").fill("a".repeat(65));

    await expect(
      component.getByText("Please enter no more than 64 characters"),
    ).toBeVisible();
    await expect(component.getByTestId("joinButton")).toBeDisabled();
  });

  test("IF-009: valid input → button enabled; click fires onPlayerID(<trimmed>) exactly once", async ({
    mount,
    page,
  }) => {
    // Pins the valid-input → enabled-button binding AND the
    // handleSubmit → onPlayerID(playerID) call with the trimmed value.
    // validateId trims the raw input, so typing "  abc-123_DEF  "
    // stores `playerID = "abc-123_DEF"` and that's what should be
    // passed to onPlayerID.
    await setupGlobals(page, {
      cdnURL: "http://localhost:9091",
      checkVideo: false,
      checkAudio: false,
      customIdInstructions: "none",
    });

    const onPlayerIDCalls = [];
    const onPlayerID = (value) => {
      onPlayerIDCalls.push(value);
    };

    const component = await mount(<IdForm onPlayerID={onPlayerID} />, {
      hooksConfig: empiricaConfig(),
    });

    await component.getByTestId("inputPaymentId").fill("  abc-123_DEF  ");

    // Button is enabled, no error text rendered.
    await expect(component.getByTestId("joinButton")).toBeEnabled();
    await expect(
      component.getByText("Please enter at least 2 characters"),
    ).toHaveCount(0);
    await expect(component.getByText(/invalid characters/)).toHaveCount(0);

    await component.getByTestId("joinButton").click();

    // onPlayerID fires exactly once with the trimmed value. Prop
    // callbacks in Playwright CT are RPC'd back to Node, so the
    // closure-side array can be a tick behind the click — poll
    // for the call to land before asserting on contents.
    await expect.poll(() => onPlayerIDCalls.length).toBe(1);
    expect(onPlayerIDCalls).toEqual(["abc-123_DEF"]);
  });

  test("IF-010: invalid then corrected → errMsg + disabled clear reactively", async ({
    mount,
    page,
  }) => {
    // Proves the bindings update on EVERY onChange, not just first
    // render: an invalid value should set errMsg + disable the button,
    // then replacing it with a valid value should clear errMsg and
    // re-enable the button without remounting.
    await setupGlobals(page, {
      cdnURL: "http://localhost:9091",
      checkVideo: false,
      checkAudio: false,
      customIdInstructions: "none",
    });

    const component = await mount(<IdForm onPlayerID={() => {}} />, {
      hooksConfig: empiricaConfig(),
    });

    // First: invalid input — errMsg shown, button disabled.
    await component.getByTestId("inputPaymentId").fill("a");
    await expect(
      component.getByText("Please enter at least 2 characters"),
    ).toBeVisible();
    await expect(component.getByTestId("joinButton")).toBeDisabled();

    // Then: correct it to a valid value — errMsg clears, button enables.
    await component.getByTestId("inputPaymentId").fill("validId123");
    await expect(
      component.getByText("Please enter at least 2 characters"),
    ).toHaveCount(0);
    await expect(component.getByTestId("joinButton")).toBeEnabled();
  });
});
