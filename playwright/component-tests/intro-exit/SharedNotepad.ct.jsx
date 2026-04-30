import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { SharedNotepad } from "../../../client/src/components/SharedNotepad";

/**
 * Component tests for SharedNotepad — partial closure of issue #53.
 *
 * SharedNotepad wraps an Etherpad <iframe>. We can't test what Etherpad
 * does inside the iframe in isolation (that's L3 — needs a real or
 * stubbed pad server). What we *can* pin offline is the React wrapper:
 * how padId is composed from props + game.id, the loading/iframe
 * branch, the iframe attributes (id, title, height, src params), and
 * the lifecycle signals the component sends to game state on mount /
 * unmount.
 *
 * Behaviors under test:
 *
 *   SN-001  When game.get(padId) is null → <p>Loading...</p> renders,
 *           no iframe.
 *   SN-002  On mount, useEffect fires game.set("newEtherpad", ...) with
 *           padId composed as `${padName}_${game.id}` and whitespace in
 *           padName collapsed to underscores.
 *   SN-003  When the client URL is in game state, the iframe renders
 *           with the expected static URL params (showChat=false,
 *           showLineNumbers=false, useMonospaceFont=false, noColors=true,
 *           lang=en, etc.) and userName from player.id.
 *   SN-004  Iframe structural attrs: id is `position_<pos>_<padName>`,
 *           title is "etherpad editor", and height is `(rows + 1) * 30`
 *           px when rows is provided.
 *   SN-004b Iframe height defaults to 400px when `rows` is omitted.
 *   SN-005  On unmount, the cleanup fires game.set("etherpadDataReady",
 *           ...) with padId, padName, progressLabel and stageTimeElapsed
 *           captured at unmount — this is the signal the server callback
 *           uses to fetch + persist the pad text.
 */

const BASE_URL = "https://etherpad.example/p/abc";

const empiricaConfig = ({
  gameId = "g1",
  gameAttrs = {},
  playerId = "p0",
  playerAttrs = { position: "0" },
  progressLabel = "stage_0_notes",
  elapsedTime = 12.5,
} = {}) => ({
  empirica: {
    currentPlayerId: playerId,
    players: [{ id: playerId, attrs: playerAttrs }],
    game: { id: gameId, attrs: gameAttrs },
    stage: { attrs: {} },
    stageTimer: { elapsed: 0 },
    progressLabel,
    elapsedTime,
  },
});

test.describe("SharedNotepad", () => {
  test("SN-001: no client URL in game state → renders Loading placeholder, no iframe", async ({
    mount,
  }) => {
    // Pins the loading branch — without this we'd silently regress to a
    // broken iframe with src="undefined" if game.get(padId) ever returned
    // empty.
    const component = await mount(
      <SharedNotepad padName="notes" defaultText="" />,
      { hooksConfig: empiricaConfig() },
    );

    await expect(component.getByText("Loading...")).toBeVisible();
    await expect(component.locator("iframe")).toHaveCount(0);
  });

  test("SN-002: mount fires game.set('newEtherpad', { padId, defaultText }) with whitespace-collapsed padId", async ({
    mount,
    page,
  }) => {
    // Pins padId composition: `${padName}_${game.id}` with all runs of
    // whitespace replaced by `_`. The server uses this id as the
    // canonical pad key, so its derivation is load-bearing.
    await mount(
      <SharedNotepad padName="my  notes" defaultText="hello world" />,
      { hooksConfig: empiricaConfig({ gameId: "g1" }) },
    );

    const newEtherpadCalls = await page.evaluate(() =>
      window.mockEmpiricaContext.game.getSetCalls("newEtherpad"),
    );
    expect(newEtherpadCalls).toHaveLength(1);
    expect(newEtherpadCalls[0].value).toEqual({
      padId: "my_notes_g1",
      defaultText: "hello world",
    });
  });

  test("SN-003: iframe src is clientURL + expected static query params + userName=player.id", async ({
    mount,
    page,
  }) => {
    // Pins the URL params we send to Etherpad. These flags drive what the
    // pad UI shows participants — drift here changes participant UX
    // silently.
    const component = await mount(
      <SharedNotepad padName="notes" defaultText="" />,
      { hooksConfig: empiricaConfig({ playerId: "alice" }) },
    );

    // Simulate the server callback writing the pad URL back into game
    // state under the padId key.
    await page.evaluate((url) => {
      window.mockEmpiricaContext.game.set("notes_g1", url);
    }, BASE_URL);

    const iframe = component.locator("iframe");
    await expect(iframe).toBeVisible();
    const src = await iframe.getAttribute("src");
    expect(src).not.toBeNull();

    const url = new URL(src);
    expect(`${url.origin}${url.pathname}`).toBe(BASE_URL);
    expect(url.searchParams.get("userName")).toBe("alice");
    expect(url.searchParams.get("showChat")).toBe("false");
    expect(url.searchParams.get("showLineNumbers")).toBe("false");
    expect(url.searchParams.get("showControls")).toBe("false");
    expect(url.searchParams.get("useMonospaceFont")).toBe("false");
    expect(url.searchParams.get("noColors")).toBe("true");
    expect(url.searchParams.get("alwaysShowChat")).toBe("false");
    expect(url.searchParams.get("lang")).toBe("en");
    expect(url.searchParams.get("rtl")).toBe("false");
    expect(url.searchParams.get("focusOnLine")).toBe("0");
  });

  test("SN-004: iframe structural attrs — id from player.position + padName, title, height from rows", async ({
    mount,
    page,
  }) => {
    // Pins the DOM hooks Cypress + accessibility tooling rely on: the
    // iframe id (used by tests and screenshots to find a player's pad)
    // and the height calculation `(rows + 1) * 30`px from the `rows`
    // prop. Default height (no `rows`) is covered by SN-004b.
    const component = await mount(
      <SharedNotepad padName="notes" defaultText="" rows={5} />,
      {
        hooksConfig: empiricaConfig({
          playerId: "p0",
          playerAttrs: { position: "2" },
        }),
      },
    );

    await page.evaluate((url) => {
      window.mockEmpiricaContext.game.set("notes_g1", url);
    }, BASE_URL);

    const iframe = component.locator("iframe");
    await expect(iframe).toHaveAttribute("id", "position_2_notes");
    await expect(iframe).toHaveAttribute("title", "etherpad editor");
    // (rows + 1) * 30 = 180 — the height accommodates the toolbar row.
    await expect(iframe).toHaveAttribute("height", "180px");
  });

  test("SN-004b: omitting `rows` prop falls back to default 400px iframe height", async ({
    mount,
    page,
  }) => {
    // Pins the default fallback when researchers don't supply `rows` in
    // the DSL — separates this from SN-004 because Playwright CT only
    // allows one mount per test.
    const component = await mount(
      <SharedNotepad padName="notes" defaultText="" />,
      { hooksConfig: empiricaConfig() },
    );
    await page.evaluate((url) => {
      window.mockEmpiricaContext.game.set("notes_g1", url);
    }, BASE_URL);
    await expect(component.locator("iframe")).toHaveAttribute(
      "height",
      "400px",
    );
  });

  test("SN-005: unmount fires game.set('etherpadDataReady', { padId, padName, progressLabel, stageTimeElapsed })", async ({
    mount,
    page,
  }) => {
    // Pins the unmount signal. The server callback listens for
    // `etherpadDataReady` to fetch + persist the pad text and decorate
    // the saved record with progressLabel + stageTimeElapsed (matches
    // stagebook's wrappedSave shape). Regressing the unmount handler
    // would silently lose pad data on stage transitions.
    const component = await mount(
      <SharedNotepad padName="notes" defaultText="" />,
      {
        hooksConfig: empiricaConfig({
          progressLabel: "stage_0_notes",
          elapsedTime: 12.5,
        }),
      },
    );

    // Sanity: no etherpadDataReady call before unmount.
    let dataReadyCalls = await page.evaluate(() =>
      window.mockEmpiricaContext.game.getSetCalls("etherpadDataReady"),
    );
    expect(dataReadyCalls).toHaveLength(0);

    await component.unmount();

    dataReadyCalls = await page.evaluate(() =>
      window.mockEmpiricaContext.game.getSetCalls("etherpadDataReady"),
    );
    expect(dataReadyCalls).toHaveLength(1);
    expect(dataReadyCalls[0].value).toEqual({
      padId: "notes_g1",
      padName: "notes",
      progressLabel: "stage_0_notes",
      stageTimeElapsed: 12.5,
    });
  });
});
