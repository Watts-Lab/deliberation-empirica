import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { SplitEmitHarness } from "./SplitEmitHarness";

/**
 * Test A: torn-render regression guards for the Empirica cross-hook race.
 *
 * Drives stage transitions through the split-emit mock provider with each
 * race shape and asserts two things:
 *
 *   1. WITHOUT the gate, the probe sees at least one incoherent render
 *      (proves the simulation reproduces the race — if this doesn't fail,
 *       the mock is lying and the test has no teeth).
 *
 *   2. WITH the gate, the probe never sees an incoherent render (the
 *      actual behavior we ship).
 *
 * The probe logs `{ useStageId, playerStageStageID }` on every render. An
 * incoherent render is one where those disagree (or where playerStageStageID
 * is null while useStageId is set, which is also a torn state — the gate
 * should hide both cases).
 *
 * Harness lives in ./SplitEmitHarness.jsx so the test file stays focused on
 * assertions.
 */

test.describe("Stage coherence gate", () => {
  test.describe.configure({ mode: "serial" });

  const RACES = ["race-1", "race-2", "race-3"];

  for (const race of RACES) {
    test(`TORN-${race.toUpperCase()}-A: ungated probe observes incoherent render under ${race}`, async ({
      mount,
      page,
    }) => {
      await mount(<SplitEmitHarness gated={false} race={race} />);
      await page.waitForFunction(() => window.__probeDone === true, {
        timeout: 5000,
      });
      const renders = await page.evaluate(() => window.__probeRenders);
      const incoherent = renders.filter((r) => !r.coherent);
      expect(incoherent.length).toBeGreaterThan(0);
    });

    test(`TORN-${race.toUpperCase()}-B: gated probe sees only coherent renders under ${race}`, async ({
      mount,
      page,
    }) => {
      await mount(<SplitEmitHarness gated race={race} />);
      await page.waitForFunction(() => window.__probeDone === true, {
        timeout: 5000,
      });
      const renders = await page.evaluate(() => window.__probeRenders);
      expect(renders.length).toBeGreaterThan(0);
      for (const r of renders) {
        expect(r.coherent).toBe(true);
      }
      // Gate must EVENTUALLY let the new stage through — a test that holds
      // forever on a loading sentinel would pass the "all coherent" check
      // trivially but be useless. Assert the last observed render is on
      // the post-transition stage.
      const last = renders[renders.length - 1];
      expect(last.useStageId).toBe("stage-B");
      expect(last.playerStageStageID).toBe("stage-B");
    });
  }

  test("TORN-CLEAN: clean transitions are coherent with or without gate", async ({
    mount,
    page,
  }) => {
    await mount(<SplitEmitHarness gated race="clean" />);
    await page.waitForFunction(() => window.__probeDone === true, {
      timeout: 5000,
    });
    const renders = await page.evaluate(() => window.__probeRenders);
    for (const r of renders) {
      expect(r.coherent).toBe(true);
    }
  });
});
