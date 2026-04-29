import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { EnterNickname } from "../../../client/src/intro-exit/EnterNickname";

/**
 * Component tests for EnterNickname (intro step).
 *
 * Replaces the L2-shaped pieces of cypress 01:132-134 (`stepNickname`).
 * Today there is zero CT/unit coverage for this step.
 *
 * Behaviors under test:
 *
 *   NN-001  Typing into the input + clicking Continue calls
 *           player.set("name", <typed value>) and invokes next()
 *   NN-002  Empty submit still calls next() — the input has no
 *           required validation today; pin current behavior so a
 *           future "must enter a nickname" gate is a deliberate
 *           change visible in this test
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

test.describe("EnterNickname", () => {
  test("NN-001: typing + Continue sets player.name and calls next()", async ({
    mount,
    page,
  }) => {
    let nextCalls = 0;
    const onNext = () => {
      nextCalls += 1;
    };

    const component = await mount(<EnterNickname next={onNext} />, {
      hooksConfig: empiricaConfig(),
    });

    await component.getByTestId("inputNickname").fill("alice_test");
    await component.getByTestId("continueNickname").click();

    // player.set was tracked on the mock — pull the value back.
    const playerSets = await page.evaluate(() =>
      window.mockPlayers[0].getAllSetCalls(),
    );
    const nameSet = playerSets.find((c) => c.key === "name");
    expect(nameSet).toBeDefined();
    expect(nameSet.value).toBe("alice_test");
    expect(nextCalls).toBe(1);
  });

  test("NN-002: empty submit still calls next() (no required validation today)", async ({
    mount,
    page,
  }) => {
    let nextCalls = 0;
    const onNext = () => {
      nextCalls += 1;
    };

    const component = await mount(<EnterNickname next={onNext} />, {
      hooksConfig: empiricaConfig(),
    });

    await component.getByTestId("continueNickname").click();

    // player.set("name", "") still fires; pin the current behavior so
    // a future required-input gate is a deliberate, visible change.
    const playerSets = await page.evaluate(() =>
      window.mockPlayers[0].getAllSetCalls(),
    );
    const nameSet = playerSets.find((c) => c.key === "name");
    expect(nameSet).toBeDefined();
    expect(nameSet.value).toBe("");
    expect(nextCalls).toBe(1);
  });
});
