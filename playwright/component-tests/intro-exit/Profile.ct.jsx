import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { Profile } from "../../../client/src/Profile";

/**
 * Component tests for Profile — the small per-player header strip
 * that displays `player.title` (or a "Time Remaining:" fallback) +
 * the ProfileTimer.
 *
 * Replaces cypress 01:313-317 which asserted that a player at
 * position 0 saw "Title-A-Position-0" rendered. The full path is:
 * server-side dispatch sets `player.title` from
 * `treatment.groupComposition[position].title` (callbacks.js:594);
 * the client renders `player.get("title")` here.
 *
 * This file pins the *render* side of that path. The server-side
 * mapping is a one-line `player.set("title", ...)` in callbacks.js
 * during dispatch — covered indirectly by the multi/ chat e2e
 * (which uses `groupComposition` titles in its treatment fixture)
 * and by `dispatch.test.js` for the dispatch logic itself.
 *
 *   PROF-001  When `player.title` is set → that string renders in
 *             the title slot
 *   PROF-002  When `player.title` is unset → the fallback
 *             "Time Remaining:" string renders
 *   PROF-003  The profile root (data-testid="profile") always
 *             renders so layout-dependent CSS doesn't collapse
 */

const empiricaConfig = (titleAttr) => ({
  empirica: {
    currentPlayerId: "p0",
    players: [
      {
        id: "p0",
        attrs: titleAttr === undefined ? {} : { title: titleAttr },
      },
    ],
    game: { attrs: {} },
    stage: { attrs: {} },
    stageTimer: { elapsed: 30_000, ended: false },
  },
});

test.describe("Profile", () => {
  test("PROF-001: player.title set → that string renders", async ({
    mount,
  }) => {
    const component = await mount(<Profile />, {
      hooksConfig: empiricaConfig("Title-A-Position-0"),
    });

    await expect(component.getByText("Title-A-Position-0")).toBeVisible();
    // Fallback should NOT also render.
    await expect(component.getByText("Time Remaining:")).toHaveCount(0);
  });

  test("PROF-002: player.title unset → 'Time Remaining:' fallback", async ({
    mount,
  }) => {
    const component = await mount(<Profile />, {
      hooksConfig: empiricaConfig(undefined),
    });

    await expect(component.getByText("Time Remaining:")).toBeVisible();
  });

  test("PROF-003: profile root always renders (layout slot is preserved)", async ({
    mount,
  }) => {
    const component = await mount(<Profile />, {
      hooksConfig: empiricaConfig(undefined),
    });

    await expect(component.getByTestId("profile")).toBeVisible();
  });
});
