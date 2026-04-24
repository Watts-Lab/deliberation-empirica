import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { Lobby } from "../../../client/src/intro-exit/Lobby";

/**
 * Component Tests for Lobby
 *
 * Replaces cypress/e2e/12_Not_Matched.js. Cypress 12 walked a single
 * participant through intro → consent → attention check → video check
 * → nickname just to land them in the lobby and assert that after
 * ~8 seconds the "taking longer than we expected" timeout message
 * appeared. None of the scaffolding is germane to the behavior under
 * test — Lobby is a self-contained component whose only inputs are
 * the player's `exitCodes` attribute and the passage of time.
 *
 * Lobby behavior under test:
 *   - Renders an initial "Matching you..." message on mount.
 *   - Records `localTimeEnteredLobby = Date.now()` on first mount.
 *   - After `LOBBY_TIMEOUT` (10 min in prod, 8 s when `window.Cypress`
 *     is set) the component switches to the timeout message.
 *   - The timeout message surfaces the player's `exitCodes.lobbyTimeout`
 *     with a copy-to-clipboard control, unless `exitCodes === "none"`.
 *
 * Tests:
 *   LOBBY-001  initial "Matching you" message visible on mount
 *   LOBBY-002  after 10+ minutes the timeout message appears
 *   LOBBY-003  timeout message surfaces the lobbyTimeout exit code
 *   LOBBY-004  exitCodes="none" hides the exit-code line (timeout still shows)
 *   LOBBY-005  localTimeEnteredLobby is set on mount
 *   LOBBY-006  copy-to-clipboard button triggers alert containing the code
 *
 * Mock setup:
 *   - MockEmpiricaProvider provides usePlayer()
 *   - `page.clock.install()` + `fastForward` drives the 10-minute timer
 *     deterministically instead of sleeping in real time
 */

const EXIT_CODES = {
  complete: "TEST_COMPLETE",
  error: "TEST_ERROR",
  lobbyTimeout: "TEST_LOBBY_TIMEOUT",
  failedEquipmentCheck: "TEST_FAILED_EQUIP",
};

function empiricaConfig(exitCodes = EXIT_CODES) {
  return {
    empirica: {
      currentPlayerId: "p0",
      players: [{ id: "p0", attrs: { exitCodes } }],
    },
  };
}

test.describe("Lobby", () => {
  test("LOBBY-001: initial 'Matching you' message visible on mount", async ({
    mount,
  }) => {
    const component = await mount(<Lobby />, {
      hooksConfig: empiricaConfig(),
    });

    await expect(
      component.getByText("Matching you with a group..."),
    ).toBeVisible();
    await expect(component.getByText(/taking longer/)).not.toBeVisible();
  });

  test("LOBBY-002: after 10+ minutes the timeout message appears", async ({
    mount,
    page,
  }) => {
    await page.clock.install();

    const component = await mount(<Lobby />, {
      hooksConfig: empiricaConfig(),
    });

    await expect(
      component.getByText("Matching you with a group..."),
    ).toBeVisible();

    // LOBBY_TIMEOUT is 10 min in production; advance past it.
    await page.clock.fastForward(11 * 60 * 1000);

    await expect(component.getByText(/taking longer/)).toBeVisible();
    // Initial message should no longer be rendered once the timeout fires.
    await expect(
      component.getByText("Matching you with a group..."),
    ).not.toBeVisible();
  });

  test("LOBBY-003: timeout message surfaces the lobbyTimeout exit code", async ({
    mount,
    page,
  }) => {
    await page.clock.install();

    const component = await mount(<Lobby />, {
      hooksConfig: empiricaConfig(),
    });

    await page.clock.fastForward(11 * 60 * 1000);

    await expect(component.getByText(/TEST_LOBBY_TIMEOUT/)).toBeVisible();
    await expect(component.getByText("Copy to clipboard")).toBeVisible();
  });

  test("LOBBY-004: exitCodes='none' hides the exit-code line", async ({
    mount,
    page,
  }) => {
    await page.clock.install();

    const component = await mount(<Lobby />, {
      hooksConfig: empiricaConfig("none"),
    });

    await page.clock.fastForward(11 * 60 * 1000);

    // Timeout message still shows…
    await expect(component.getByText(/taking longer/)).toBeVisible();
    // …but no exit code or copy control.
    await expect(component.getByText(/TEST_LOBBY_TIMEOUT/)).not.toBeVisible();
    await expect(component.getByText("Copy to clipboard")).not.toBeVisible();
  });

  test("LOBBY-005: localTimeEnteredLobby is set on mount", async ({
    mount,
    page,
  }) => {
    await mount(<Lobby />, { hooksConfig: empiricaConfig() });

    // The set happens inside a useEffect, so it may not have flushed by
    // the time this evaluates. Poll until the attribute lands.
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const p = window.mockPlayers?.find((pl) => pl.id === "p0");
            return p?.get("localTimeEnteredLobby");
          }),
        { timeout: 5000 },
      )
      .toEqual(expect.any(Number));
  });

  test("LOBBY-006: copy-to-clipboard triggers alert with the code", async ({
    mount,
    page,
  }) => {
    await page.clock.install();

    // Clipboard API may not exist in the CT iframe; stub it before clicking.
    await page.evaluate(() => {
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        navigator.clipboard = { writeText: () => Promise.resolve() };
      }
    });

    let dialogMessage = null;
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    const component = await mount(<Lobby />, {
      hooksConfig: empiricaConfig(),
    });

    await page.clock.fastForward(11 * 60 * 1000);

    await component.getByText("Copy to clipboard").click();

    await expect.poll(() => dialogMessage, { timeout: 5000 }).not.toBeNull();
    expect(dialogMessage).toContain("TEST_LOBBY_TIMEOUT");
    expect(dialogMessage).toContain("clipboard");
  });
});
