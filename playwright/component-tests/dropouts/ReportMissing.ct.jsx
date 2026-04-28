import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { ReportMissingHarness } from "./_helpers/ReportMissingHarness";

/**
 * Component tests for the ReportMissing flow in
 * `client/src/components/discussion/call/ReportMissing.jsx`.
 *
 * Replaces the L2-shaped pieces of cypress/e2e/11_Dropouts.js. Two
 * cypress tests covered things this file pins:
 *   - "clears timeout timer on stage end" (regression for issue #1109)
 *   - "manages dropouts" (modal interaction shape, action shape)
 *
 * Cypress 11's "hides report missing button when showReportMissing is
 * false" was already covered by Tray.ct (per #37). The full
 * multi-player video-discussion timing (timer fires when not enough
 * check-ins) needs Daily-mocked L3 infra — see follow-up issue.
 *
 *   RM-001  Modal opens on `openReportMissing()` and shows the three
 *           radio options
 *   RM-002  Cancel closes the modal without appending anything
 *   RM-003  Submit "playerAbsent" appends reports / checkIns /
 *           checkInRequests (with the right shape) but does NOT show
 *           the waiting toast (no timer started)
 *   RM-004  Submit "onlyOne" appends + shows the waiting toast
 *   RM-005  Submit "noDiscussant" → same as RM-004 (timer + toast)
 *   RM-006  MissingParticipantRespond ("Are you there?") shows when
 *           game.checkInRequests has an entry for the current stage
 *           and the player hasn't checked in within gracePeriod
 *   RM-007  Clicking "I'm here!" appends to player.checkIns
 *   RM-008  MissingParticipantRespond is NOT shown when the player
 *           already checked in within the grace window
 *   RM-008b MissingParticipantRespond IS shown when the last check-in
 *           is older than gracePeriod (boundary check on the other
 *           side of RM-008)
 *   RM-009  Stage change clears the response timer (#1109 regression):
 *           the waiting toast disappears, no `Ending discussion`
 *           console log fires, and no `submit` / `discussionFailed`
 *           lands on the player even after the original timeout would
 *           have fired
 *   RM-010  Success toast ("At least one other person has confirmed
 *           their presence.") fires when passedCheckIn() returns
 *           true; the `2 players checked in` log fires
 *   RM-011  A second report on the same player in the same stage
 *           appends a second `reports` AND a second `checkIns` entry
 *           (cypress 11 pinned `reports.length === 2` after a
 *           dropout-then-second-report)
 */

// ReportMissingProvider hardcodes timeout=60s and gracePeriod=10s in
// non-Cypress mode (`!window.Cypress`). We don't try to set a
// window.Cypress flag from here — `page.addInitScript` doesn't run in
// Playwright CT's iframe before mount, leaving the flag undefined.
// Instead:
//   - tests that don't depend on time (RM-001..RM-007) just exercise
//     the UI flow at the current `stageTimer.elapsed` and pin action
//     shapes
//   - RM-008's gracePeriod boundary is tested with timestamps chosen
//     to work under the production 10s grace
//   - RM-009 uses `page.clock` to fastForward past the 60s timeout so
//     the regression is pinned without 60+ real seconds of waiting

// Common config — single player p0 at position 0. Tests override what
// they need (e.g., pre-existing checkInRequests on the game).
const baseEmpirica = {
  currentPlayerId: "p0",
  players: [{ id: "p0", attrs: { position: 0, name: "alice" } }],
  game: { attrs: {} },
  stage: { attrs: {} },
  stageTimer: { elapsed: 30_000 },
  progressLabel: "game_0_test_stage",
};

test.describe("ReportMissing modal", () => {
  test("RM-001: openReportMissing shows the modal with three radio options", async ({
    mount,
  }) => {
    const component = await mount(<ReportMissingHarness />, {
      hooksConfig: { empirica: baseEmpirica },
    });

    await component.getByTestId("reportMissing").click();
    await expect(
      component.getByRole("heading", { name: "Report Missing Participant" }),
    ).toBeVisible();
    await expect(
      component.getByText("I am the only one in the video call."),
    ).toBeVisible();
    await expect(
      component.getByText(
        "Nobody else in the call is participating in the discussion.",
      ),
    ).toBeVisible();
    await expect(
      component.getByText(
        "Not everybody is participating in the discussion, but I still have someone to talk with.",
      ),
    ).toBeVisible();
  });

  test("RM-002: Cancel closes the modal and resets selection", async ({
    mount,
    page,
  }) => {
    const component = await mount(<ReportMissingHarness />, {
      hooksConfig: { empirica: baseEmpirica },
    });

    await component.getByTestId("reportMissing").click();
    await component.getByText("I am the only one in the video call.").click();
    await component.getByTestId("cancelReportMissing").click();

    await expect(
      component.getByRole("heading", { name: "Report Missing Participant" }),
    ).toHaveCount(0);

    // No appends fired.
    const calls = await page.evaluate(() => ({
      reports: window.mockPlayers[0].getAppendCalls("reports"),
      checkIns: window.mockPlayers[0].getAppendCalls("checkIns"),
      requests:
        window.mockEmpiricaContext?.game?.getAppendCalls?.("checkInRequests") ??
        [],
    }));
    expect(calls.reports).toEqual([]);
    expect(calls.checkIns).toEqual([]);
    expect(calls.requests).toEqual([]);
  });

  test("RM-003: Submit playerAbsent appends reports/checkIns/checkInRequests but does NOT start the timer", async ({
    mount,
    page,
  }) => {
    const component = await mount(<ReportMissingHarness />, {
      hooksConfig: {
        empirica: { ...baseEmpirica, stageTimer: { elapsed: 12_345 } },
      },
    });

    await component.getByTestId("reportMissing").click();
    await component
      .getByText(
        "Not everybody is participating in the discussion, but I still have someone to talk with.",
      )
      .click();
    await component.getByTestId("submitReportMissing").click();

    const stageElapsed = 12.345;
    const reports = await page.evaluate(() =>
      window.mockPlayers[0].getAppendCalls("reports").map((c) => c.value),
    );
    expect(reports).toEqual([
      {
        code: "playerAbsent",
        stage: "game_0_test_stage",
        timestamp: stageElapsed,
      },
    ]);

    const checkIns = await page.evaluate(() =>
      window.mockPlayers[0].getAppendCalls("checkIns").map((c) => c.value),
    );
    expect(checkIns).toEqual([
      { stage: "game_0_test_stage", timestamp: stageElapsed },
    ]);

    const requests = await page.evaluate(() =>
      window.mockEmpiricaContext.game
        .getAppendCalls("checkInRequests")
        .map((c) => c.value),
    );
    expect(requests).toEqual([
      { stage: "game_0_test_stage", timestamp: stageElapsed },
    ]);

    // playerAbsent → no timer, no waiting toast.
    await expect(
      component.getByText("Asking others to confirm their presence."),
    ).toHaveCount(0);
  });

  test("RM-004: Submit onlyOne shows the waiting toast (timer started)", async ({
    mount,
  }) => {
    const component = await mount(<ReportMissingHarness />, {
      hooksConfig: { empirica: baseEmpirica },
    });

    await component.getByTestId("reportMissing").click();
    await component.getByText("I am the only one in the video call.").click();
    await component.getByTestId("submitReportMissing").click();

    await expect(
      component.getByText("Asking others to confirm their presence."),
    ).toBeVisible();
  });

  test("RM-005: Submit noDiscussant shows the waiting toast (timer started)", async ({
    mount,
  }) => {
    const component = await mount(<ReportMissingHarness />, {
      hooksConfig: { empirica: baseEmpirica },
    });

    await component.getByTestId("reportMissing").click();
    await component
      .getByText("Nobody else in the call is participating in the discussion.")
      .click();
    await component.getByTestId("submitReportMissing").click();

    await expect(
      component.getByText("Asking others to confirm their presence."),
    ).toBeVisible();
  });
});

test.describe("MissingParticipantRespond modal", () => {
  test("RM-006: respond modal shows when there's a check-in request for the current stage", async ({
    mount,
  }) => {
    const component = await mount(<ReportMissingHarness />, {
      hooksConfig: {
        empirica: {
          ...baseEmpirica,
          // Pre-populate a check-in request from another player.
          game: {
            attrs: {
              checkInRequests: [{ stage: "game_0_test_stage", timestamp: 1.0 }],
            },
          },
        },
      },
    });

    await expect(
      component.getByRole("heading", { name: "Are you there?" }),
    ).toBeVisible();
    await expect(component.getByTestId("checkIn")).toBeVisible();
  });

  test("RM-007: clicking 'I'm here!' appends to player.checkIns", async ({
    mount,
    page,
  }) => {
    const component = await mount(<ReportMissingHarness />, {
      hooksConfig: {
        empirica: {
          ...baseEmpirica,
          stageTimer: { elapsed: 7_000 },
          game: {
            attrs: {
              checkInRequests: [{ stage: "game_0_test_stage", timestamp: 1.0 }],
            },
          },
        },
      },
    });

    await component.getByTestId("checkIn").click();

    const checkIns = await page.evaluate(() =>
      window.mockPlayers[0].getAppendCalls("checkIns").map((c) => c.value),
    );
    expect(checkIns).toEqual([{ stage: "game_0_test_stage", timestamp: 7.0 }]);
  });

  test("RM-008: respond modal is NOT shown when player already checked in within gracePeriod", async ({
    mount,
  }) => {
    const component = await mount(<ReportMissingHarness />, {
      hooksConfig: {
        empirica: {
          ...baseEmpirica,
          stageTimer: { elapsed: 30_000 },
          // Production gracePeriod is 10s. Request landed at 25.0s,
          // player checked in at 20.0s — within the grace window
          // (request.timestamp - gracePeriod = 25.0 - 10 = 15.0s;
          // checkIn timestamp 20.0 > 15.0). The respond modal must
          // stay hidden.
          players: [
            {
              id: "p0",
              attrs: {
                position: 0,
                name: "alice",
                checkIns: [{ stage: "game_0_test_stage", timestamp: 20.0 }],
              },
            },
          ],
          game: {
            attrs: {
              checkInRequests: [
                { stage: "game_0_test_stage", timestamp: 25.0 },
              ],
            },
          },
        },
      },
    });

    // No "Are you there?" modal — recent check-in suppresses it.
    await expect(
      component.getByRole("heading", { name: "Are you there?" }),
    ).toHaveCount(0);
  });

  test("RM-008b: respond modal IS shown when last check-in is older than gracePeriod", async ({
    mount,
  }) => {
    const component = await mount(<ReportMissingHarness />, {
      hooksConfig: {
        empirica: {
          ...baseEmpirica,
          stageTimer: { elapsed: 60_000 },
          // checkIn at 5.0s; request at 50.0s. 50 - 10 (gracePeriod) =
          // 40.0; 5.0 > 40.0 is false → modal must show because the
          // player's last check-in is well before the grace window.
          players: [
            {
              id: "p0",
              attrs: {
                position: 0,
                name: "alice",
                checkIns: [{ stage: "game_0_test_stage", timestamp: 5.0 }],
              },
            },
          ],
          game: {
            attrs: {
              checkInRequests: [
                { stage: "game_0_test_stage", timestamp: 50.0 },
              ],
            },
          },
        },
      },
    });

    await expect(
      component.getByRole("heading", { name: "Are you there?" }),
    ).toBeVisible();
  });
});

test.describe("ReportMissing #1109 regression", () => {
  test("RM-009: stage change clears the response timer — toast stays gone, no 'Ending discussion' log, and no auto-submit fires", async ({
    mount,
    page,
  }) => {
    // Drive the timer with page.clock so we can fast-forward past the
    // 60-second production timeout in milliseconds, instead of
    // burning real test time. install() must run BEFORE mount so the
    // setTimeout the component schedules uses the fake clock.
    await page.clock.install();

    // Capture all browser console messages — `timeoutCheckIn` logs
    // "Ending discussion due to lack of participants" if it fires.
    // The cypress 11 regression equivalence depends on that log NOT
    // appearing post-stage-change.
    const consoleMessages = [];
    page.on("console", (msg) => {
      consoleMessages.push(msg.text());
    });

    const component = await mount(<ReportMissingHarness />, {
      hooksConfig: { empirica: baseEmpirica },
    });

    // Submit "onlyOne" so the timer starts and the waiting toast shows.
    await component.getByTestId("reportMissing").click();
    await component.getByText("I am the only one in the video call.").click();
    await component.getByTestId("submitReportMissing").click();
    await expect(
      component.getByText("Asking others to confirm their presence."),
    ).toBeVisible();

    // Reset tracking so we can isolate post-stage-change appends/sets.
    // MockPlayer always constructs a nested MockStage in its
    // constructor (mocks/empirica/MockPlayer.js), so the chain is
    // expected to be live — drop the optional-chain that previously
    // masked a missing-mock failure mode.
    await page.evaluate(() => {
      window.mockPlayers[0].resetTracking();
      window.mockPlayers[0].stage.resetTracking();
    });

    // Stage transition — fires the cleanup useEffect that's the
    // #1109 fix (clears the timer, hides the toast).
    await page.evaluate(() => {
      window.mockEmpiricaSetProgressLabel("game_1_next_stage");
    });
    await expect(
      component.getByText("Asking others to confirm their presence."),
    ).toHaveCount(0);

    // Fast-forward past the original 60-second timeout. If the
    // cleanup didn't clear the timer, timeoutCheckIn would fire here
    // and call `player.set("discussionFailed", true)` +
    // `player.stage.set("submit", true)` because passedCheckIn
    // returns false (only the reporter checked in).
    await page.clock.fastForward(70_000);
    // Let React flush any work the fired timer would have produced.
    await page.waitForTimeout(200);

    const setCalls = await page.evaluate(() => ({
      stageSets: window.mockPlayers[0].stage.getAllSetCalls(),
      playerSets: window.mockPlayers[0].getAllSetCalls(),
    }));

    // `discussionFailed` must NOT have been set on the player.
    expect(
      setCalls.playerSets.find((c) => c.key === "discussionFailed"),
    ).toBeUndefined();
    // `submit` must NOT have been set on the player.stage.
    expect(setCalls.stageSets.find((c) => c.key === "submit")).toBeUndefined();
    // The waiting toast must not have reappeared — a regression that
    // re-armed the timer would re-flash the toast on the next stage.
    await expect(
      component.getByText("Asking others to confirm their presence."),
    ).toHaveCount(0);
    // And `timeoutCheckIn` must NOT have logged its diagnostic — that
    // log is only emitted from the function the cleared timer would
    // have called.
    expect(
      consoleMessages.some((m) =>
        m.includes("Ending discussion due to lack of participants"),
      ),
    ).toBe(false);
  });
});

test.describe("ReportMissing — multi-action shapes", () => {
  test("RM-010: success toast and `N players checked in` log fire when 2+ players are checked in", async ({
    mount,
    page,
  }) => {
    // Capture console messages so we can pin the `passedCheckIn` log.
    const consoleMessages = [];
    page.on("console", (msg) => {
      consoleMessages.push(msg.text());
    });

    // Two players. p0 (reporter) will submit "onlyOne", which auto-
    // appends to its own checkIns. p1's checkIn is pre-populated, so
    // by the time p0 submits, `passedCheckIn` already counts 2 and
    // the success-toast branch fires (line 184–190 of ReportMissing).
    const component = await mount(<ReportMissingHarness />, {
      hooksConfig: {
        empirica: {
          ...baseEmpirica,
          stageTimer: { elapsed: 30_000 },
          players: [
            { id: "p0", attrs: { position: 0, name: "alice" } },
            {
              id: "p1",
              attrs: {
                position: 1,
                name: "bob",
                // Pre-existing check-in for the same stage as the
                // request that p0 will create on submit.
                checkIns: [{ stage: "game_0_test_stage", timestamp: 25.0 }],
              },
            },
          ],
        },
      },
    });

    await component.getByTestId("reportMissing").click();
    await component.getByText("I am the only one in the video call.").click();
    await component.getByTestId("submitReportMissing").click();

    // Success toast text is the load-bearing UI signal that
    // `passedCheckIn` returned true. Pinning the literal string also
    // catches accidental copy edits.
    await expect(
      component.getByText(
        "At least one other person has confirmed their presence.",
      ),
    ).toBeVisible();

    // The `passedCheckIn` log fires from inside the function — pin it
    // to catch a future change that bypasses the count check.
    await expect
      .poll(() =>
        consoleMessages.some((m) => /\b2 players checked in\b/.test(m)),
      )
      .toBe(true);
  });

  test("RM-011: a second report on the same player appends a second `reports` AND a second `checkIns` entry", async ({
    mount,
    page,
  }) => {
    const component = await mount(<ReportMissingHarness />, {
      hooksConfig: {
        empirica: {
          ...baseEmpirica,
          stageTimer: { elapsed: 40_000 },
          // Pre-existing report + checkIn on the player from an
          // earlier (in-stage) submit. `getAppendCalls` only tracks
          // appends fired via .append() on the mock, NOT seeded
          // attrs, so we don't need to count those — we just need
          // the next submit to push the totals.
          players: [
            {
              id: "p0",
              attrs: {
                position: 0,
                name: "alice",
                reports: [
                  {
                    code: "onlyOne",
                    stage: "game_0_test_stage",
                    timestamp: 20.0,
                  },
                ],
                checkIns: [{ stage: "game_0_test_stage", timestamp: 20.0 }],
              },
            },
          ],
        },
      },
    });

    await component.getByTestId("reportMissing").click();
    await component
      .getByText(
        "Not everybody is participating in the discussion, but I still have someone to talk with.",
      )
      .click();
    await component.getByTestId("submitReportMissing").click();

    // The second submit should push exactly one more append onto each
    // append-list (reports, checkIns, checkInRequests). Track-only
    // counts isolate this submit from the seeded history.
    const appendCounts = await page.evaluate(() => ({
      reports: window.mockPlayers[0].getAppendCalls("reports").length,
      checkIns: window.mockPlayers[0].getAppendCalls("checkIns").length,
      requests:
        window.mockEmpiricaContext.game.getAppendCalls("checkInRequests")
          .length,
    }));
    expect(appendCounts).toEqual({ reports: 1, checkIns: 1, requests: 1 });

    // The cumulative shape (seeded + new) is what the science-data
    // export reads, so verify the second report code lands in the
    // tracked-append list with the right code.
    const lastReport = await page.evaluate(() => {
      const all = window.mockPlayers[0].getAppendCalls("reports");
      return all[all.length - 1].value;
    });
    expect(lastReport).toMatchObject({
      code: "playerAbsent",
      stage: "game_0_test_stage",
      timestamp: 40.0,
    });
  });
});
