import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { NoGames } from "../../../client/src/intro-exit/NoGames";

/**
 * Component Tests for NoGames
 *
 * Replaces cypress/e2e/04_No_Experiments_Available.js. Cypress 04
 * stood up Empirica + visited the root URL with no batch active and
 * checked that "There are no studies available" rendered persistently
 * (not as a flash). NoGames has *three* branches based on player
 * state, only one of which the cypress spec exercised. This suite
 * covers all three.
 *
 * NoGames branches:
 *   - no player (batch closed before this user registered) →
 *     "There are no studies available at this time"
 *   - player exists but `playerComplete !== true` (registered, didn't
 *     finish before the batch was terminated) → "The experiment is
 *     now closed"
 *   - player exists and `playerComplete === true` (finished the
 *     experiment, batch later terminated) → "Thank you for
 *     participating!" plus the complete-exit code, unless
 *     `exitCodes === "none"` in which case the code line is omitted.
 *
 * Tests:
 *   NG-001  no player → "There are no studies available"
 *   NG-002  Markdown Loading gate suppresses branch messages until globals arrive
 *   NG-003  no player → no consent / payment-id artifacts visible
 *   NG-004  player without playerComplete → "experiment is now closed"
 *   NG-005  player with playerComplete=true → "Thank you for participating"
 *   NG-006  completed player → exit code displayed
 *   NG-007  completed player with exitCodes="none" → no exit code line
 *
 * Mock setup:
 *   - MockEmpiricaProvider supplies usePlayer()
 *   - For the no-player branch, mount without a hooksConfig so
 *     usePlayer returns null
 *
 * Coverage gap vs cypress 04 (acknowledged):
 *   Cypress 04 waited 1s post-mount to catch a flash-through during
 *   live Empirica bootstrap (subscription handshake, batch query
 *   resolving to empty, etc.). That async path doesn't run in CT — we
 *   mount NoGames in isolation against synthetic state. NG-002 covers
 *   the only flash source NoGames itself owns (the Markdown Loading
 *   gate); a regression in Empirica's bootstrap-time render order
 *   would not be caught here and would need an L3 e2e test.
 */

const EXIT_CODES = {
  complete: "TEST_COMPLETE_CODE",
  error: "TEST_ERROR_CODE",
  lobbyTimeout: "TEST_LOBBY_CODE",
  failedEquipmentCheck: "TEST_EQUIP_CODE",
};

// NoGames renders text via the platform Markdown component, which
// gates its render on `useGlobal()` returning a recruitingBatchConfig.
// Without the global mock the component shows a Loading spinner and
// no text-content assertions match. Set this in every test.
async function setupGlobals(page) {
  await page.evaluate(() => {
    window.__mockGlobal = {
      get: (key) =>
        key === "recruitingBatchConfig"
          ? { cdnURL: "http://localhost:9091" }
          : null,
    };
  });
}

function configForCompletedPlayer(exitCodes = EXIT_CODES) {
  return {
    empirica: {
      currentPlayerId: "p0",
      players: [
        {
          id: "p0",
          attrs: { playerComplete: true, exitCodes },
        },
      ],
    },
  };
}

function configForRegisteredPlayer() {
  return {
    empirica: {
      currentPlayerId: "p0",
      // playerComplete not set → undefined → branch 2 ("experiment closed")
      players: [{ id: "p0", attrs: {} }],
    },
  };
}

test.describe("NoGames", () => {
  test("NG-001: no player → 'no studies available' message renders", async ({
    mount,
    page,
  }) => {
    await setupGlobals(page);

    // Mount without empirica config so usePlayer() returns null.
    const component = await mount(<NoGames />);

    await expect(
      component.getByText("There are no studies available at this time."),
    ).toBeVisible();
  });

  test("NG-002: Markdown Loading gate suppresses all branch messages until globals arrive", async ({
    mount,
  }) => {
    // Cypress 04 waited 1s and re-asserted "no studies available" to
    // catch a flash-through during live Empirica bootstrap. That async
    // path doesn't exist in CT (the component renders synchronously
    // here), so reproducing the wait is a no-op. The component-level
    // analogue is the Markdown wrapper's `useGlobal()` Loading gate:
    // without globals, Markdown returns <Loading /> and no message
    // text should reach the DOM. If a future change made NoGames
    // render messages outside the Markdown wrapper, any of the three
    // branch strings could leak before globals load.
    //
    // Mount without setupGlobals so useGlobal() returns null.
    const component = await mount(<NoGames />);

    // None of the branch messages should be visible while Markdown is
    // gated behind the Loading state.
    await expect(
      component.getByText("There are no studies available at this time."),
    ).not.toBeVisible();
    await expect(
      component.getByText("The experiment is now closed."),
    ).not.toBeVisible();
    await expect(
      component.getByText("Thank you for participating!"),
    ).not.toBeVisible();
  });

  test("NG-003: no player → no consent / payment-id artifacts", async ({
    mount,
    page,
  }) => {
    await setupGlobals(page);

    const component = await mount(<NoGames />);

    // Use `toHaveCount(0)` (DOM absence) rather than `not.toBeVisible()`
    // (DOM-present-but-hidden also passes) so this matches cypress 04's
    // stricter `should('not.exist')` semantics.
    await expect(component.getByText(/payment ID/i)).toHaveCount(0);
    await expect(component.getByText("Join the study")).toHaveCount(0);
  });

  test("NG-004: registered player without playerComplete → 'experiment is now closed'", async ({
    mount,
    page,
  }) => {
    await setupGlobals(page);

    const component = await mount(<NoGames />, {
      hooksConfig: configForRegisteredPlayer(),
    });

    await expect(
      component.getByText("The experiment is now closed."),
    ).toBeVisible();
    // The "no studies available" message is for a *different* branch
    // and should not appear here.
    await expect(
      component.getByText("There are no studies available at this time."),
    ).not.toBeVisible();
  });

  test("NG-005: completed player → 'Thank you for participating' message", async ({
    mount,
    page,
  }) => {
    await setupGlobals(page);

    const component = await mount(<NoGames />, {
      hooksConfig: configForCompletedPlayer(),
    });

    await expect(
      component.getByText("Thank you for participating!"),
    ).toBeVisible();
    await expect(
      component.getByText("The experiment is now closed."),
    ).not.toBeVisible();
  });

  test("NG-006: completed player → exit code rendered", async ({
    mount,
    page,
  }) => {
    await setupGlobals(page);

    const component = await mount(<NoGames />, {
      hooksConfig: configForCompletedPlayer(),
    });

    await expect(component.getByText(/TEST_COMPLETE_CODE/)).toBeVisible();
  });

  test("NG-007: completed player with exitCodes='none' → no code rendered", async ({
    mount,
    page,
  }) => {
    await setupGlobals(page);

    const component = await mount(<NoGames />, {
      hooksConfig: configForCompletedPlayer("none"),
    });

    await expect(
      component.getByText("Thank you for participating!"),
    ).toBeVisible();
    // None of the test exit codes should leak through.
    await expect(component.getByText(/TEST_COMPLETE_CODE/)).not.toBeVisible();
    await expect(component.getByText(/TEST_LOBBY_CODE/)).not.toBeVisible();
  });
});
