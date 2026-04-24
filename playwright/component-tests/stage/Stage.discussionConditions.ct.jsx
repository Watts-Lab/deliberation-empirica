import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { Stage } from "../../../client/src/Stage";

/**
 * Component Tests for Stage — Discussion Conditions
 *
 * Replaces cypress/e2e/17_Discussion_Conditions.js. Cypress 17 spun up a
 * full Empirica server, walked two participants through intro → consent
 * → attention check → nickname → lobby, then stepped through four
 * stages just to assert whether `[data-testid="discussion"]` rendered.
 *
 * All of that was scaffolding for what is really a single Stage-level
 * behavior: stagebook's `<Stage>` decides whether to render the
 * discussion column based on (a) `discussion.conditions` evaluated
 * against participant state and (b) `showToPositions` /
 * `hideFromPositions` against the current player's position. We can
 * test that directly by mounting `<Stage>` with mocked Empirica state.
 *
 * Tests:
 *   DC-001  discussion renders when condition met (equals HTML, position: all)
 *   DC-002  discussion hidden when condition fails
 *   DC-003  discussion hidden via hideFromPositions for listed position
 *   DC-004  discussion shown when player's position is not in hideFromPositions
 *
 * Mock setup:
 *   - MockEmpiricaProvider provides player/game/stage state
 *   - window.__mockGlobal provides recruitingBatchConfig.cdnURL so the
 *     stagebook adapter's `contentVersion` flips to 1
 *   - No prompt elements are used (submitButton only) so no text-content
 *     fetch is attempted
 *   - `prompt.setupChoice` reference resolves via stagebook's
 *     getReferenceKeyAndPath → `prompt_setupChoice` → player.get,
 *     with `{ value: "HTML" }` shaped the way stagebook's save side
 *     would have stored it
 */

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

function stageConfigWithConditionMet() {
  return {
    name: "Discussion Condition Met",
    duration: 3600,
    elements: [{ type: "submitButton" }],
    discussion: {
      chatType: "text",
      showNickname: true,
      showTitle: true,
      conditions: [
        {
          reference: "prompt.setupChoice",
          comparator: "equals",
          position: "all",
          value: "HTML",
        },
      ],
    },
  };
}

function stageConfigWithConditionFailing() {
  const base = stageConfigWithConditionMet();
  return {
    ...base,
    name: "Discussion Condition Not Met",
    discussion: {
      ...base.discussion,
      conditions: [
        {
          reference: "prompt.setupChoice",
          comparator: "equals",
          position: "all",
          value: "Markdown",
        },
      ],
    },
  };
}

function stageConfigHiddenFromPositions(hideFromPositions) {
  return {
    name: "Discussion Position Hidden",
    duration: 3600,
    elements: [{ type: "submitButton" }],
    discussion: {
      chatType: "text",
      showNickname: true,
      showTitle: true,
      hideFromPositions,
    },
  };
}

function twoPlayers({ currentPlayerId = "p0", setupChoice = "HTML" } = {}) {
  return {
    currentPlayerId,
    players: [
      {
        id: "p0",
        attrs: {
          position: "0",
          prompt_setupChoice: { value: setupChoice },
        },
      },
      {
        id: "p1",
        attrs: {
          position: "1",
          prompt_setupChoice: { value: setupChoice },
        },
      },
    ],
    game: { attrs: {} },
  };
}

test.describe("Stage — discussion conditions", () => {
  test("DC-001: discussion renders when condition is met (equals HTML, position: all)", async ({
    mount,
    page,
  }) => {
    await setupGlobals(page);

    const component = await mount(<Stage />, {
      hooksConfig: {
        empirica: {
          ...twoPlayers({ setupChoice: "HTML" }),
          stage: { attrs: stageConfigWithConditionMet() },
        },
      },
    });

    // `data-testid="discussion"` appears on two nested elements when the
    // discussion renders: stagebook's column wrapper + our Discussion
    // component. `.first()` selects the outer one unambiguously.
    await expect(
      component.locator('[data-testid="discussion"]').first(),
    ).toBeVisible();
  });

  test("DC-002: discussion hidden when condition fails (equals Markdown while value is HTML)", async ({
    mount,
    page,
  }) => {
    await setupGlobals(page);

    const component = await mount(<Stage />, {
      hooksConfig: {
        empirica: {
          ...twoPlayers({ setupChoice: "HTML" }),
          stage: { attrs: stageConfigWithConditionFailing() },
        },
      },
    });

    await expect(component.locator('[data-testid="discussion"]')).toHaveCount(
      0,
    );
  });

  test("DC-003: discussion hidden via hideFromPositions for the current player", async ({
    mount,
    page,
  }) => {
    await setupGlobals(page);

    // Current player is p0 at position "0"; 0 is in hideFromPositions.
    const component = await mount(<Stage />, {
      hooksConfig: {
        empirica: {
          ...twoPlayers({ currentPlayerId: "p0" }),
          stage: { attrs: stageConfigHiddenFromPositions([0, 1]) },
        },
      },
    });

    await expect(component.locator('[data-testid="discussion"]')).toHaveCount(
      0,
    );
  });

  test("DC-004: discussion shown when player's position is not in hideFromPositions", async ({
    mount,
    page,
  }) => {
    await setupGlobals(page);

    // hideFromPositions: [1] hides from p1 only — current player p0 at
    // position "0" should still see the discussion.
    const component = await mount(<Stage />, {
      hooksConfig: {
        empirica: {
          ...twoPlayers({ currentPlayerId: "p0" }),
          stage: { attrs: stageConfigHiddenFromPositions([1]) },
        },
      },
    });

    // `data-testid="discussion"` appears on two nested elements when the
    // discussion renders: stagebook's column wrapper + our Discussion
    // component. `.first()` selects the outer one unambiguously.
    await expect(
      component.locator('[data-testid="discussion"]').first(),
    ).toBeVisible();
  });
});
