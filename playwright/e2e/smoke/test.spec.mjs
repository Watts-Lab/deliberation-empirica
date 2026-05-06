import { test, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, resolve, join } from "path";
import { readdirSync, readFileSync } from "fs";

import { launchStack } from "../_helpers/empiricaServer.mjs";
import { installBrowserMocks } from "../_helpers/installBrowserMocks.mjs";
import { batchConfig } from "../_helpers/batchConfig.mjs";
import { walkToLobby } from "../_helpers/walkParticipant.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(__dirname, "./fixtures");

let stack;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({}, testInfo) => {
  stack = await launchStack({
    workerIndex: testInfo.workerIndex,
    fixtureDir,
    logPrefix: "smoke",
  });
});

test.afterAll(async () => {
  if (stack) await stack.stop();
});

// Drive the admin UI to create and start a batch pointed at this worker's
// fixture CDN. Returns the batch name so tests can find the JSONL file later.
async function createAndStartBatch(page) {
  const batchName = `smoke_${Date.now()}`;
  const config = batchConfig({ batchName, treatments: ["smoke_2p"] });

  await page.goto(stack.urls.admin, { waitUntil: "load" });
  await page.locator('button[data-test="newBatchButton"]').click();
  await page.locator('button[data-test="customAssignmentButton"]').click();
  const textarea = page.locator('textarea[data-test="configurationTextArea"]');
  await textarea.fill(JSON.stringify(config, null, 2));
  await page.locator('[data-test="createBatchButton"]').click();
  // Start button appears once validation passes and the batch is ready.
  const startBtn = page.locator('[data-test="startButton"]').first();
  await startBtn.waitFor({ state: "visible", timeout: 30_000 });
  await startBtn.click();
  // After starting, a stopButton replaces the startButton.
  await page.locator('[data-test="stopButton"]').first().waitFor({
    state: "visible",
    timeout: 15_000,
  });
  return { batchName };
}

// Drive one participant from landing page through the game stage submit.
// Returns the unique prompt response string the participant typed, so the
// test can match it back to a scienceData row.
async function runParticipant(page, { playerKey }) {
  // Walk the standard intro flow into the lobby; the prompt-fill +
  // submit below is smoke-specific (drives the openResponse value
  // that we later assert round-trips into scienceData).
  await walkToLobby(page, { url: stack.urls.player, playerKey });

  // Lobby → dispatched into game stage. Wait specifically for the prompt
  // textarea (not the submit button) because stagebook needs the prompt
  // markdown body parsed before it renders the input. Earlier this used
  // `if (await promptBox.count())` and silently fell through when the
  // prompt errored — see the PR #43 CORS-fix history. Now we require the
  // textarea to actually render so a regression in the CDN/CORS setup
  // would fail this test rather than silently pass.
  const promptBox = page.locator(
    '[data-testid="element-prompt-smokePrompt"] textarea',
  );
  await promptBox.waitFor({ state: "visible", timeout: 60_000 });

  // Use a unique response per participant so the test can match it back
  // to a specific scienceData row regardless of row order.
  const promptResponse = `smoke response from ${playerKey}`;
  await promptBox.fill(promptResponse);
  // Stagebook openResponse debounces text saves at 2000ms (vs ~50ms for
  // interactive clicks). Wait past the debounce before clicking submit
  // so the value actually reaches Empirica state — otherwise scienceData
  // exports rows with empty `prompts: {}`.
  await page.waitForTimeout(2500);

  await page.locator('[data-testid="submitButton"]').click();

  return { promptResponse };
}

test("smoke: admin creates batch, two participants play through, data exported", async ({
  browser,
}) => {
  // Track every context we open so a try/finally below closes them all
  // even if an assertion or awaited step throws — otherwise contexts
  // leak across tests and the worker behaves unpredictably.
  const contexts = [];
  const newContext = async () => {
    const ctx = await browser.newContext();
    contexts.push(ctx);
    return ctx;
  };

  let adminPage;
  try {
    // 1. Admin: create + start batch (own context so admin cookies don't bleed
    //    into participant pages).
    const adminContext = await newContext();
    adminPage = await adminContext.newPage();
    const { batchName } = await createAndStartBatch(adminPage);

    // 2. Two participants in parallel, each in its own context (separate
    //    Empirica player sessions). Install browser-side mocks for
    //    ipwho.is + the VPN list so connectionInfo.country and
    //    isKnownVpn are deterministic — without these, country comes
    //    back undefined in CI and the VPN-list fetch hits real github.
    const p1Context = await newContext();
    const p2Context = await newContext();
    await installBrowserMocks(p1Context);
    await installBrowserMocks(p2Context);
    const p1 = await p1Context.newPage();
    const p2 = await p2Context.newPage();

    const p1Key = `smoke_p1_${Date.now()}`;
    const p2Key = `smoke_p2_${Date.now()}`;
    const [p1Result, p2Result] = await Promise.all([
      runParticipant(p1, { playerKey: p1Key }),
      runParticipant(p2, { playerKey: p2Key }),
    ]);

    // 3. Admin stops the batch — that's what triggers closeOutPlayer →
    //    exportScienceData for any players who didn't finish QC. Clicking
    //    Stop pops a window.confirm; accept it via Playwright's dialog
    //    handler before the click fires.
    adminPage.once("dialog", (dialog) => dialog.accept());
    await adminPage.locator('[data-test="stopButton"]').first().click();
    // Wait for the batch to actually flip to terminated before reading the
    // file. Empirica's admin UI removes the Stop button (and shows "Ended")
    // once the server has closed the batch.
    await adminPage
      .locator('[data-test="stopButton"]')
      .first()
      .waitFor({ state: "detached", timeout: 15_000 });
    // closeOutPlayer runs async after status change; a small settle window
    // lets the JSONL writes land.
    await adminPage.waitForTimeout(2000);

    // 4. Find the scienceData JSONL (filename includes a server-side timestamp
    //    prefix so we can't predict it exactly; match by batchName suffix).
    const files = readdirSync(stack.dataDir);
    const scienceFile = files.find(
      (f) => f.endsWith(".scienceData.jsonl") && f.includes(batchName),
    );
    expect(
      scienceFile,
      `expected a scienceData jsonl for batch ${batchName} in ${stack.dataDir}, got: ${files.join(", ")}`,
    ).toBeTruthy();

    const body = readFileSync(join(stack.dataDir, scienceFile), "utf8").trim();
    expect(body.length, "scienceData file is empty").toBeGreaterThan(0);
    const lines = body.split("\n").filter(Boolean);
    expect(lines.length, "expected one scienceData row per participant").toBe(
      2,
    );

    // Each row should be valid JSON with the core platform-populated keys.
    const rows = lines.map((l) => JSON.parse(l));
    for (const row of rows) {
      expect(row).toHaveProperty("batchId");
      expect(row).toHaveProperty("sampleId");
      expect(row).toHaveProperty("deliberationId");
      expect(row).toHaveProperty("treatment");
      expect(row).toHaveProperty("exitStatus");
      // assetsRepoSha is stamped at batch init (GitHub ref lookup via mock);
      // the mock returns a deterministic 40-hex sha.
      expect(row.assetsRepoSha).toMatch(/^[0-9a-f]{40}$/);
      // Treatment metadata round-trips into the export.
      expect(row.treatment?.name).toBe("smoke_2p");
      // The specific prompt key must be present on every row — pinning
      // `prompts.prompt_smokePrompt.value` per-row catches a regression
      // where the key gets renamed, missing on one player, or where a
      // single row accidentally collects both responses. Aggregating
      // values across rows would silently pass any of those bugs.
      expect(row.prompts?.prompt_smokePrompt?.value).toEqual(
        expect.any(String),
      );

      // browserInfo + connectionInfo are populated by Consent.jsx
      // when the player clicks "I AGREE":
      //   - browserInfo from `window.navigator` + screen (deterministic
      //     from the test browser)
      //   - connectionInfo from useConnectionInfo() (which fires
      //     ipwho.is + the VPN list — both mocked above via
      //     installBrowserMocks) + navigator.connection
      //
      // Cypress 01:1105-1109 pinned both sides. With the browser
      // mocks in place we can match that fidelity at L3.
      expect(row.browserInfo).toBeTruthy();
      expect(row.browserInfo.width).toBeGreaterThan(0);
      expect(row.browserInfo.userAgent).toEqual(expect.any(String));
      expect(row.browserInfo.language).toEqual(expect.any(String));
      expect(row.connectionInfo).toBeTruthy();
      // From the mocked ipwho.is response. Cypress 01:1108-1109's
      // `expect(row.connectionInfo.country).to.equal("US")` — same
      // string, deterministic now that the request is intercepted.
      expect(row.connectionInfo.country).toBe("US");
      // VPN-list mock returns an empty body → no IP match →
      // isKnownVpn=false. Pin the populated path.
      expect(row.connectionInfo.isKnownVpn).toBe(false);
      // navigator.connection.effectiveType is overlaid in the consent
      // submit handler — a string like "4g" / "3g" / etc.
      expect(typeof row.connectionInfo.effectiveType).toBe("string");
    }

    // Pin the round-trip: the set of per-row prompt values equals
    // exactly the set of strings the two participants typed. Order-
    // independent (row order is not guaranteed) but exhaustive (no
    // missing or duplicated values).
    const perRowResponses = rows
      .map((r) => r.prompts.prompt_smokePrompt.value)
      .sort();
    expect(perRowResponses).toEqual(
      [p1Result.promptResponse, p2Result.promptResponse].sort(),
    );

    // exitStatus is "incomplete" because admin stops the batch before
    // participants walk through the post-game exit sequence (QC survey,
    // debrief). The "complete" close-out path is intentionally out of
    // scope for smoke — solo/cancel pins "incomplete" too, by design.
    for (const row of rows) {
      expect(row.exitStatus).toBe("incomplete");
    }

    // 5. The server hits GitHub on startup for `checkGithubAuth` (calls
    //    octokit.rest.rateLimit.get to verify the token works). Verify
    //    the mock intercepted that call — proves the mock is wired up
    //    end-to-end without requiring us to configure preregRepos/dataRepos.
    const githubCalls = stack.mock.recorded.filter(
      (r) => r.provider === "github",
    );
    expect(
      githubCalls.length,
      "expected the server to hit the GitHub mock at least once during batch init",
    ).toBeGreaterThan(0);
    // All GitHub calls should have passed our spec-driven auth check
    // (otherwise they'd be 401s), proving the server is sending a
    // well-formed Authorization header.
    for (const call of githubCalls) {
      expect(
        call.responseStatus,
        `github ${call.method} ${call.path} returned ${call.responseStatus}`,
      ).toBeLessThan(400);
    }
  } finally {
    // Best-effort context cleanup so a failed assertion above doesn't
    // leak across tests in the same worker.
    await Promise.all(contexts.map((ctx) => ctx.close().catch(() => {})));
  }
});
