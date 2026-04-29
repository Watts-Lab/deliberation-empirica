import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { Countdown } from "../../../client/src/intro-exit/Countdown";

/**
 * Component tests for Countdown (intro step) — the launch-date wait
 * + ready-chime cadence + proceed-button gate.
 *
 * Replaces the L2-shaped pieces of cypress 01:262-279 (the
 * "Check countdown" block — proceedButton appears, "Played Ready
 * Chime N times" console logs at the configured interval).
 *
 * Behaviors under test:
 *
 *   CD-001  launchDate in the future → "Keep this window open" wait
 *           copy renders; no proceedButton
 *   CD-002  launchDate in the past (already launched) → "Part 2 is
 *           ready" + proceedButton; click invokes next()
 *   CD-003  Once launched, the chime fires immediately and logs
 *           "Played Ready Chime 1 times" to the console
 *   CD-004  After advancing past the chime interval, the chime fires
 *           again ("Played Ready Chime 2 times")
 *   CD-005  On mount, player.set("inCountdown", true) and
 *           player.set("localClockTime", <now>) are called once
 */

const empiricaConfig = (overrides = {}) => ({
  empirica: {
    currentPlayerId: "p0",
    players: [{ id: "p0", attrs: {} }],
    game: { attrs: {} },
    stage: { attrs: {} },
    stageTimer: { elapsed: 0 },
    ...overrides,
  },
});

// `new Audio("westminster_quarters.mp3")` would otherwise try to GET a
// real mp3 from the test page (404) and `chime.play()` would reject
// in autoplay-blocked test browsers. Stub it with a noop class.
async function stubAudio(page) {
  await page.evaluate(() => {
    window.Audio = class MockAudio {
      constructor(src) {
        this.src = src;
        this._playCalls = 0;
      }
      play() {
        this._playCalls += 1;
        return Promise.resolve();
      }
      pause() {}
    };
  });
}

// Capture console messages so chime-cadence tests can assert on the
// "Played Ready Chime N times" log without spying.
async function captureConsole(page) {
  const messages = [];
  page.on("console", (msg) => messages.push(msg.text()));
  return messages;
}

test.describe("Countdown — pre/post launch render", () => {
  test.beforeEach(async ({ page }) => {
    await stubAudio(page);
  });

  test("CD-001: launchDate in the future → wait copy + no proceedButton", async ({
    mount,
  }) => {
    let nextCalls = 0;
    // 60 seconds in the future.
    const launchDate = new Date(Date.now() + 60_000).toISOString();

    const component = await mount(
      <Countdown
        launchDate={launchDate}
        next={() => {
          nextCalls += 1;
        }}
      />,
      { hooksConfig: empiricaConfig() },
    );

    // "Keep this window open" appears twice in the wait copy
    // (headline + reminder). Either matches; first() avoids the
    // strict-mode violation.
    await expect(
      component.getByText("Keep this window open").first(),
    ).toBeVisible();
    await expect(component.getByText(/begins in/i)).toBeVisible();
    await expect(component.getByTestId("proceedButton")).toHaveCount(0);
    expect(nextCalls).toBe(0);
  });

  test("CD-002: launchDate in the past → proceedButton; click calls next()", async ({
    mount,
  }) => {
    let nextCalls = 0;
    // Launched 5 seconds ago.
    const launchDate = new Date(Date.now() - 5_000).toISOString();

    const component = await mount(
      <Countdown
        launchDate={launchDate}
        next={() => {
          nextCalls += 1;
        }}
      />,
      { hooksConfig: empiricaConfig() },
    );

    await expect(
      component.getByText("Part 2 is ready to begin.", { exact: false }),
    ).toBeVisible();
    const proceed = component.getByTestId("proceedButton");
    await expect(proceed).toBeVisible();

    await proceed.click();
    expect(nextCalls).toBe(1);
  });

  test("CD-005: on mount, sets inCountdown=true and localClockTime", async ({
    mount,
    page,
  }) => {
    const launchDate = new Date(Date.now() + 60_000).toISOString();
    await mount(<Countdown launchDate={launchDate} next={() => {}} />, {
      hooksConfig: empiricaConfig(),
    });

    // Both sets land inside a useEffect that runs after the first
    // commit — poll rather than reading synchronously, so the test
    // doesn't race the effect flush.
    const readKey = (key) =>
      page.evaluate(
        (k) =>
          window.mockPlayers[0].getAllSetCalls().find((c) => c.key === k) ??
          null,
        key,
      );

    await expect.poll(() => readKey("inCountdown")).not.toBeNull();
    const inCountdown = await readKey("inCountdown");
    expect(inCountdown.value).toBe(true);

    await expect.poll(() => readKey("localClockTime")).not.toBeNull();
    const localClockTime = await readKey("localClockTime");
    expect(typeof localClockTime.value).toBe("number");
    expect(localClockTime.value).toBeGreaterThan(0);
  });
});

test.describe("Countdown — chime cadence", () => {
  test("CD-003 + CD-004: chime fires immediately on launch + at the interval", async ({
    mount,
    page,
  }) => {
    // Install the fake clock BEFORE mount so the setInterval the chime
    // effect schedules uses fake time. Also capture console so we can
    // count the "Played Ready Chime N times" log instead of spying on
    // the Audio mock from across the iframe boundary.
    await page.clock.install();
    await stubAudio(page);
    const consoleMessages = await captureConsole(page);

    // Launched 1 second ago — already past the launch boundary, so the
    // chime effect runs on first render.
    const launchDate = new Date(Date.now() - 1_000).toISOString();

    await mount(<Countdown launchDate={launchDate} next={() => {}} />, {
      hooksConfig: empiricaConfig(),
    });

    // Initial chime fires synchronously inside the useEffect.
    await expect
      .poll(() =>
        consoleMessages.some((m) => m.includes("Played Ready Chime 1 times")),
      )
      .toBe(true);
    // Second log should not yet exist.
    expect(
      consoleMessages.some((m) => m.includes("Played Ready Chime 2 times")),
    ).toBe(false);

    // Production interval is 90 seconds; cypress mode is 6 seconds.
    // We're in neither, but `page.clock.fastForward` advances the
    // fake clock — the setInterval (no `window.Cypress` flag) is
    // scheduled at 90s. fastForward 91s past launch.
    await page.clock.fastForward(91_000);
    await expect
      .poll(() =>
        consoleMessages.some((m) => m.includes("Played Ready Chime 2 times")),
      )
      .toBe(true);
  });
});
