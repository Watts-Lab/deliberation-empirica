import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { AttentionCheck } from "../../../client/src/intro-exit/AttentionCheck";

/**
 * Component tests for AttentionCheck (intro step).
 *
 * Replaces the L2-shaped pieces of cypress 01:122-124 (`stepAttentionCheck`).
 * Today there is zero CT/unit coverage for this step.
 *
 * Behaviors under test:
 *
 *   AC-001  Typing the wrong sentence + Continue → does NOT advance,
 *           renders the diagnostic mark elements (correctPortion +
 *           incorrectPortion) splitting the original at the first
 *           mismatch index
 *   AC-002  Typing the *exact* expected sentence + Continue → calls
 *           next(), records `duration_AttentionCheck` on the player
 *   AC-003  Whitespace-tolerance: extra spaces collapse on submit;
 *           still advances on otherwise-correct input
 *   AC-004  Paste is blocked on the input (preventDefault on onPaste)
 *           — guards against participants pasting the prompt rather
 *           than typing it
 */

const SENTENCE =
  "I agree to participate in this study to the best of my ability.";

const empiricaConfig = () => ({
  empirica: {
    currentPlayerId: "p0",
    players: [{ id: "p0", attrs: {} }],
    game: { attrs: {} },
    stage: { attrs: {} },
    stageTimer: { elapsed: 0 },
    elapsedTime: 4.2, // useGetElapsedTime returns this for the duration save
  },
});

test.describe("AttentionCheck", () => {
  test("AC-001: typing the wrong sentence shows diagnostic mark + does not advance", async ({
    mount,
  }) => {
    let nextCalls = 0;
    const onNext = () => {
      nextCalls += 1;
    };

    const component = await mount(<AttentionCheck next={onNext} />, {
      hooksConfig: empiricaConfig(),
    });

    // Type a sentence that first diverges at index 4 ("I agree" →
    // "I aggree" — the doubled 'g' lands at position 4).
    await component.getByTestId("inputAttentionCheck").fill("I aggree to");
    await component.getByTestId("continueAttentionCheck").click();

    // Diagnostic marks should appear.
    await expect(component.getByTestId("correctPortion")).toBeVisible();
    await expect(component.getByTestId("incorrectPortion")).toBeVisible();
    // "Please correct any errors" hint renders.
    await expect(
      component.getByText("Please correct any errors"),
    ).toBeVisible();
    // next() was NOT called.
    expect(nextCalls).toBe(0);
  });

  test("AC-002: typing the exact sentence advances + saves duration_AttentionCheck", async ({
    mount,
    page,
  }) => {
    let nextCalls = 0;
    const onNext = () => {
      nextCalls += 1;
    };

    const component = await mount(<AttentionCheck next={onNext} />, {
      hooksConfig: empiricaConfig(),
    });

    await component.getByTestId("inputAttentionCheck").fill(SENTENCE);
    await component.getByTestId("continueAttentionCheck").click();

    expect(nextCalls).toBe(1);

    // duration_AttentionCheck saved on the player with the elapsed time
    // returned by useGetElapsedTime (4.2 in this config).
    const playerSets = await page.evaluate(() =>
      window.mockPlayers[0].getAllSetCalls(),
    );
    const durationSet = playerSets.find(
      (c) => c.key === "duration_AttentionCheck",
    );
    expect(durationSet).toBeDefined();
    expect(durationSet.value).toEqual({ time: 4.2 });
  });

  test("AC-003: extra whitespace is collapsed before comparison (still advances)", async ({
    mount,
  }) => {
    let nextCalls = 0;
    const onNext = () => {
      nextCalls += 1;
    };

    const component = await mount(<AttentionCheck next={onNext} />, {
      hooksConfig: empiricaConfig(),
    });

    // Insert extra spaces between words; component normalizes via
    // `str.trim().replace(/\s+/g, " ")`.
    await component
      .getByTestId("inputAttentionCheck")
      .fill(
        `  I agree   to participate  in this study to the best of my ability.  `,
      );
    await component.getByTestId("continueAttentionCheck").click();

    expect(nextCalls).toBe(1);
  });

  test("AC-004: paste on the input is blocked (preventDefault)", async ({
    mount,
  }) => {
    let nextCalls = 0;
    const onNext = () => {
      nextCalls += 1;
    };

    const component = await mount(<AttentionCheck next={onNext} />, {
      hooksConfig: empiricaConfig(),
    });

    const input = component.getByTestId("inputAttentionCheck");
    // Focus the input, then dispatch a paste event with the full
    // sentence — the onPaste handler calls preventDefault, so the
    // value should remain empty.
    await input.focus();
    await input.evaluate((el, sentence) => {
      const dt = new DataTransfer();
      dt.setData("text/plain", sentence);
      const evt = new ClipboardEvent("paste", {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
      });
      el.dispatchEvent(evt);
    }, SENTENCE);

    // Value should NOT contain the pasted sentence.
    await expect(input).toHaveValue("");

    // And clicking Continue with an empty input doesn't advance (the
    // empty string doesn't match the expected sentence).
    await component.getByTestId("continueAttentionCheck").click();
    expect(nextCalls).toBe(0);
  });
});
