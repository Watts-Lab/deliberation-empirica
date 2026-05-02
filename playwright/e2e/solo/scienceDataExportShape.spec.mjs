// scienceData export shape L3 spec. Pins durable per-row contract that
// the existing smoke spec doesn't cover — specifically the timing and
// stage-duration fields that researchers downstream rely on.
//
// What this catches that lower layers don't:
//   - L1 server-vitest tests scienceDataHelpers.test.js with hand-built
//     player/game fixtures. The fixtures stipulate which keys exist; if
//     the *client* stops writing `duration_consent` (Consent.jsx) or
//     `duration_AttentionCheck` (AttentionCheck.jsx), the unit tests
//     keep passing. Only end-to-end traversal exercises that the client
//     side actually produces the keys the export shape promises.
//   - The smoke spec pins prompts + browserInfo + connectionInfo +
//     assetsRepoSha + treatment.name, but explicitly leaves
//     stageDurations and the per-stage timing fields off — see its
//     comment "exitStatus is 'incomplete' because admin stops the batch
//     before participants walk through the post-game exit sequence".
//   - Cypress 01's omnibus did some of this, but spread across rounds
//     the contract was hard to read; this spec pins it concisely.
//
// Specifically pins (gap analysis vs. existing tests):
//   - stageDurations.duration_consent.time   ← only smoke partial parity
//   - stageDurations.duration_AttentionCheck.time
//   - times.batchInitialized
//   - times.playerArrived
//   - times.playerIntroDone (must be set after the AC + nickname walk)
//   - times.gameStarted     (set when game.start fires)
//   - position === 0        (solo: dispatcher always assigns slot 0)
//   - consent === true
//   - stageDurations contains ONLY intro/exit step keys, NOT game-stage
//     names. This is a non-obvious contract: GenericIntroExitStep.jsx
//     and Consent/AttentionCheck record durations, but Stage.jsx does
//     not. Future "fix" that adds game-stage durations would expand
//     this object and break this assertion — pin it as intentional.

import { test, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, resolve, join } from "path";
import { readdirSync, readFileSync } from "fs";

import { launchStack } from "../_helpers/empiricaServer.mjs";
import { installBrowserMocks } from "../_helpers/installBrowserMocks.mjs";
import {
  connectAsAdmin,
  readSrtoken,
  createBatch,
  startBatch,
  stopBatch,
  waitForAttribute,
} from "../_helpers/empiricaAdminAPI.mjs";
import { batchConfig } from "../_helpers/batchConfig.mjs";
import { walkToGame } from "../_helpers/walkParticipant.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(__dirname, "./fixtures");

let stack;
let admin;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({}, testInfo) => {
  stack = await launchStack({
    workerIndex: testInfo.workerIndex,
    fixtureDir,
    logPrefix: "solo-export",
  });
  admin = await connectAsAdmin({
    tajribaURL: `http://127.0.0.1:${stack.ports.empirica}/query`,
    srtoken: readSrtoken(),
  });
});

test.afterAll(async () => {
  if (stack) await stack.stop();
});

test.beforeEach(async ({ page }) => {
  await installBrowserMocks(page.context());
});

const ISO_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;

test("scienceData export shape: solo run pins stageDurations + intro timing milestones", async ({
  page,
}) => {
  const batchName = `solo_export_${Date.now()}`;
  const playerKey = `solo_export_p_${Date.now()}`;

  const batchId = await createBatch(
    admin,
    batchConfig({ batchName, treatments: ["solo_1p"] }),
  );

  try {
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.initialized === true,
      { timeoutMs: 30_000 },
    );
    await startBatch(admin, batchId);
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.status === "running",
      { timeoutMs: 5_000 },
    );

    await walkToGame(page, {
      url: stack.urls.player,
      playerKey,
      gamePromptName: "soloPrompt",
    });

    // Stop the batch — closeBatch flips exitStatus to "incomplete" and
    // runs the scienceData export. Same termination pattern as the
    // existing solo cancel test; this spec adds the deeper-shape
    // assertions on top of the same exit path.
    await stopBatch(admin, batchId);
    await waitForAttribute(
      admin,
      batchId,
      (attrs) => attrs.status === "terminated",
      { timeoutMs: 10_000 },
    );
    // closeOutPlayer + JSONL writes happen async after the status flip.
    await page.waitForTimeout(2000);

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
    const rows = body
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    expect(rows.length, "expected exactly one row for the solo participant").toBe(
      1,
    );
    const row = rows[0];

    // Sanity: this is the cancel-mid-game shape.
    expect(row.exitStatus).toBe("incomplete");

    // Position: solo dispatcher always assigns slot 0. The export
    // serializes it as the literal string "0" (not 0, not " 0", not
    // "0.0"). Pin the exact value so a serialization shift — int,
    // float, padded — would fail this assertion rather than silently
    // pass through. The dispatcher property tests assert the integer
    // invariant; this is the sister assertion at the export layer.
    expect(row.position).toBe("0");

    // Timing milestones. Each is set by a server callback at a distinct
    // point in the lifecycle. None are pinned by smoke or solo cancel.
    expect(row.times).toBeTruthy();
    expect(
      row.times.batchInitialized,
      "batchInitialized must be set by Empirica.on('batch') after createBatch fires preFlight",
    ).toMatch(ISO_RE);
    expect(
      row.times.playerArrived,
      "playerArrived must be set when the player first connects past intro",
    ).toMatch(ISO_RE);
    expect(
      row.times.playerIntroDone,
      "playerIntroDone must be set once Consent + AC + nickname have all been submitted",
    ).toMatch(ISO_RE);
    expect(
      row.times.gameStarted,
      "gameStarted must be set when the game starts (player reached stage 1)",
    ).toMatch(ISO_RE);

    // Stage durations. Only intro/exit steps record these — Consent.jsx
    // and AttentionCheck.jsx (and GenericIntroExitStep.jsx, but the
    // solo_1p treatment has no exit sequence). Game stages do NOT
    // contribute keys here. If the platform ever changes that, this
    // assertion is the canary.
    expect(row.stageDurations).toBeTruthy();
    expect(
      row.stageDurations.duration_consent,
      "duration_consent must be recorded by Consent.jsx on click",
    ).toBeTruthy();
    expect(
      typeof row.stageDurations.duration_consent.time,
      "duration_consent.time should be a number of ms",
    ).toBe("number");
    expect(row.stageDurations.duration_consent.time).toBeGreaterThanOrEqual(0);

    expect(
      row.stageDurations.duration_AttentionCheck,
      "duration_AttentionCheck must be recorded by AttentionCheck.jsx on submit",
    ).toBeTruthy();
    expect(
      typeof row.stageDurations.duration_AttentionCheck.time,
      "duration_AttentionCheck.time should be a number of ms",
    ).toBe("number");
    expect(row.stageDurations.duration_AttentionCheck.time).toBeGreaterThanOrEqual(
      0,
    );

    // Pin the negative side: NO game-stage keys leak into stageDurations.
    // The solo_1p treatment's only game stage is "Solo single stage" —
    // if a future change has Stage.jsx start writing duration_<stageName>
    // on submit, the key set here would expand and silently change the
    // researcher-facing export. The exit-sequence is "none" in the
    // batch config (no QC / debrief steps), so the only contributors
    // are Consent.jsx + AttentionCheck.jsx.
    expect(
      Object.keys(row.stageDurations).sort(),
      "stageDurations should contain ONLY the intro-step duration keys (no game stages, no exit steps)",
    ).toEqual(["duration_AttentionCheck", "duration_consent"]);

    // Consent record: Consent.jsx sets `player.set("consent", [...])`
    // with an array of consent-item keys (NOT a boolean). buildPlayerData
    // defaults `consent` to the literal string `"missing"` when the
    // attribute is absent, so a `toBeTruthy()` would not catch a
    // regression — it'd pass either way. Pin both the array shape and
    // that the array is non-empty so we know consent.jsx actually wrote
    // a record, not the platform's missing-sentinel.
    expect(
      Array.isArray(row.consent),
      `consent should be an array of consent-item keys; got: ${JSON.stringify(row.consent)}`,
    ).toBe(true);
    expect(
      row.consent.length,
      "consent array must be non-empty (at least one item key + 'agree18Understand')",
    ).toBeGreaterThan(0);
  } finally {
    await stopBatch(admin, batchId).catch(() => {});
  }
});
