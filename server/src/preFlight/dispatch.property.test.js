/* eslint-disable no-bitwise, no-restricted-syntax */
// `no-bitwise` is disabled because mulberry32 uses bit ops by
// design (PRNG, intentional). `no-restricted-syntax` is disabled
// because the invariant checks use `for...of` over assignment
// arrays — `.every()` would obscure which item failed (no early
// return preserves the assertion message via expect()).

import { vi, describe, test, expect } from "vitest";

// Property-based dispatcher tests. Pin the contracts that hold
// for *any* valid input — the bits the named/scenario tests can't
// catch because they only probe specific points in the input space.
//
// Strategy: a deterministic PRNG (mulberry32) drives a generator
// that produces random batches of (players, treatments, payoffs,
// knockdowns), and each test asserts an invariant over every
// dispatch result. With a fixed seed the suite is reproducible;
// changing the seed (or running with `PROP_SEED=...`) extends
// coverage on demand without being part of regular CI.
//
// What this covers vs. what the existing tests cover:
//   - dispatch.test.js (cypress-derived): hand-picked scenarios
//   - PR #67 combinatorial axes: edge counts, knockdown shapes,
//     fraction boundaries, eligibility patterns, multi-position
//     groupComposition — named cases organized by axis
//   - this file: random combinations across those axes, asserting
//     contract-level invariants rather than specific numeric outcomes

import { makeDispatcher } from "./dispatch";

// Mute @empirica/core/console + the stray `console.log("knockdownType",
// ...)` in dispatch.js — this suite calls makeDispatcher / dispatch
// roughly 1000× and the noise dwarfs the signal in CI. Mirrors the
// pattern in exportParticipantData.test.js. Mocked at module level
// before importing the SUT.
vi.mock("@empirica/core/console", () => ({
  info: () => {},
  warn: () => {},
  error: () => {},
  log: () => {},
}));
vi.spyOn(console, "log").mockImplementation(() => {});

class MockPlayer {
  constructor(id, responses) {
    this.id = id;
    this.responses = responses;
  }

  // Mirror dispatch.test.js's MockPlayer: scalar prompt values get
  // wrapped as `{value}` so stagebook's getReferenceKeyAndPath path
  // walk lands the right field.
  get(key) {
    const val = this.responses[key];
    if (val === undefined) return undefined;
    if (val !== null && typeof val === "object") return val;
    return { value: val };
  }
}

// Mulberry32 — small fast PRNG, fully deterministic given a seed.
// We don't need cryptographic quality; we need reproducibility +
// reasonable distribution.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROLES = ["a", "b", "c", "d"];

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function intRange(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function genPlayer(rng, idx) {
  // ~1 in 5 chance of no role, otherwise a uniform pick. Players
  // with no role can't satisfy role conditions — exercises the
  // "ineligible" branches.
  //
  // Response key is `prompt_role` (with underscore) — stagebook's
  // `getReferenceKeyAndPath("prompt.role")` returns
  // `{referenceKey: "prompt_role", path: ["value"]}`, and the
  // dispatcher does `player.get("prompt_role")`. Mirrors the
  // existing dispatch.test.js cases that use `{prompt_alpha, prompt_beta}`.
  const role = rng() < 0.2 ? null : pick(rng, ROLES);
  return new MockPlayer(`p${idx}`, { prompt_role: role });
}

function maybeRoleCondition(rng) {
  // 50/50 whether the slot has a condition. When it does, equality
  // on a random role.
  //
  // Only `equals` here on purpose — broader comparators would require
  // valid value-shape per type (numeric ranges, string-includes, etc.)
  // and we'd be testing the comparator surface, not the dispatcher.
  if (rng() < 0.5) return [];
  return [
    {
      reference: "prompt.role",
      comparator: "equals",
      value: pick(rng, ROLES),
    },
  ];
}

function genTreatment(rng, idx) {
  const playerCount = intRange(rng, 1, 4);
  // Treatment-level `conditions` (without groupComposition) are
  // silently ignored by the dispatcher — see dispatch.js:181 which
  // only reads `treatment.groupComposition?.[position].conditions`.
  // So we only emit slot-level conditions via groupComposition.
  //
  // 30% of the time, omit groupComposition entirely (unconstrained
  // treatment — every player is eligible for every slot). The other
  // 70% emits a full groupComposition with one entry per slot, where
  // each slot independently has a 50/50 chance of carrying a role
  // condition. Note: an EMPTY `groupComposition: []` would crash the
  // dispatcher (`groupComposition?.[position]` is undefined for an
  // empty array, then `.conditions` throws), so we either omit it
  // entirely or fill it to playerCount.
  if (rng() < 0.3) {
    return { name: `t${idx}`, playerCount };
  }
  const groupComposition = [];
  for (let i = 0; i < playerCount; i += 1) {
    groupComposition.push({
      position: i,
      conditions: maybeRoleCondition(rng),
    });
  }
  return { name: `t${idx}`, playerCount, groupComposition };
}

const MATRIX_SENTINEL = Symbol("matrix");

function genKnockdownsKind(rng) {
  // Three regimes: none, single scalar, square matrix.
  const r = rng();
  if (r < 0.3) return "none";
  if (r < 0.7) return 0.5 + rng() * 0.49; // single scalar in [0.5, 0.99]
  return MATRIX_SENTINEL;
}

function genScenario(rng) {
  const nPlayers = intRange(rng, 0, 25);
  const nTreatments = intRange(rng, 1, 4);
  const players = Array.from({ length: nPlayers }, (_, i) => genPlayer(rng, i));
  const treatments = Array.from({ length: nTreatments }, (_, i) =>
    genTreatment(rng, i),
  );
  const payoffs = Array.from(
    { length: nTreatments },
    () => 0.5 + rng() * 1.5, // all positive so dispatcher considers all
  );
  let knockdowns = genKnockdownsKind(rng);
  if (knockdowns === MATRIX_SENTINEL) {
    knockdowns = Array.from({ length: nTreatments }, () =>
      Array.from({ length: nTreatments }, () => 0.5 + rng() * 0.49),
    );
  }
  return { players, treatments, payoffs, knockdowns };
}

// Walk a player through a conditions list and decide whether they
// satisfy ALL of them (the dispatcher's "and" semantics for conditions
// per slot). Generator only emits `equals` on `prompt.role`, so we
// short-circuit instead of pulling in stagebook's compare. Throw
// loudly on unexpected shapes so a generator regression doesn't
// silently render this test toothless.
function playerSatisfies(player, conditions = []) {
  for (const c of conditions) {
    if (c.reference !== "prompt.role" || c.comparator !== "equals") {
      throw new Error(`unexpected condition shape: ${JSON.stringify(c)}`);
    }
    // Match dispatcher: `player.get("prompt_role")?.value`.
    const got = player.get("prompt_role")?.value;
    if (got !== c.value) return false;
  }
  return true;
}

function slotConditionsForAssignment(treatment, position) {
  if (treatment.groupComposition) {
    const slot = treatment.groupComposition.find(
      (g) => g.position === position,
    );
    return slot?.conditions ?? [];
  }
  return treatment.conditions ?? [];
}

// Format the seed+scenario context for assertion failures or
// dispatcher throws — same shape used in both paths so a repro is
// easy regardless of which side blew up.
function formatScenarioContext(seed, scenarioIdx, scenario) {
  return `[seed=0x${seed.toString(16)} scenario=${scenarioIdx}]\nscenario: ${JSON.stringify(
    {
      players: scenario.players.map((p) => ({
        id: p.id,
        responses: p.responses,
      })),
      treatments: scenario.treatments,
      payoffs: scenario.payoffs,
      knockdowns: scenario.knockdowns,
    },
    null,
    2,
  )}`;
}

// Run the dispatcher over a deterministic list of N scenarios + run
// an invariant check per scenario. Both invariant violations AND
// dispatcher throws fail the test, with the seed + scenario context
// in the assertion message. We do NOT silently swallow throws — the
// generator is designed to produce valid inputs, so a throw indicates
// either a real dispatcher bug or a generator gap worth surfacing.
function forEachScenario(seed, n, invariant) {
  const rng = makeRng(seed);
  for (let i = 0; i < n; i += 1) {
    const scenario = genScenario(rng);
    let result;
    try {
      const dispatch = makeDispatcher({
        treatments: scenario.treatments,
        payoffs: scenario.payoffs,
        knockdowns: scenario.knockdowns,
      });
      result = dispatch(scenario.players);
    } catch (err) {
      err.message = `dispatcher threw: ${err.message}\n${formatScenarioContext(seed, i, scenario)}`;
      throw err;
    }
    try {
      invariant(scenario, result, i);
    } catch (err) {
      err.message = `${err.message}\n${formatScenarioContext(seed, i, scenario)}`;
      throw err;
    }
  }
}

// Validate + normalize SEED/N from env. PROP_SEED is parsed as a
// uint32 so the displayed seed matches the value mulberry32 actually
// uses internally (it forces `seed >>> 0`). NaN / non-positive N is
// rejected loudly rather than silently producing 0 iterations.
function parseSeed(raw) {
  if (raw === undefined) return 0xdeadbeef >>> 0;
  // Accept hex prefix for ergonomic re-runs: `PROP_SEED=0xdeadbeef`.
  const parsed =
    raw.startsWith("0x") || raw.startsWith("0X")
      ? parseInt(raw.slice(2), 16)
      : parseInt(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`PROP_SEED must be a finite integer, got: ${raw}`);
  }
  return parsed >>> 0;
}
function parseN(raw) {
  if (raw === undefined) return 200;
  const parsed = parseInt(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`PROP_N must be a positive integer, got: ${raw}`);
  }
  return parsed;
}
const SEED = parseSeed(process.env.PROP_SEED);
const N = parseN(process.env.PROP_N);

describe(`dispatch property tests (seed=0x${SEED.toString(16)}, N=${N})`, () => {
  test("every assignment has exactly treatment.playerCount positionAssignments", () => {
    forEachScenario(SEED, N, (scenario, { assignments }) => {
      for (const a of assignments) {
        expect(a.positionAssignments.length).toBe(a.treatment.playerCount);
      }
    });
  });

  test("no player id appears in more than one assignment", () => {
    forEachScenario(SEED + 1, N, (scenario, { assignments }) => {
      const seen = new Set();
      for (const a of assignments) {
        for (const pa of a.positionAssignments) {
          expect(seen.has(pa.playerId)).toBe(false);
          seen.add(pa.playerId);
        }
      }
    });
  });

  test("every assignment's treatment is from the input set", () => {
    forEachScenario(SEED + 2, N, (scenario, { assignments }) => {
      const validNames = new Set(scenario.treatments.map((t) => t.name));
      for (const a of assignments) {
        expect(validNames.has(a.treatment.name)).toBe(true);
      }
    });
  });

  test("every assigned player satisfies the slot conditions they're placed in", () => {
    forEachScenario(SEED + 3, N, (scenario, { assignments }) => {
      const playersById = new Map(scenario.players.map((p) => [p.id, p]));
      for (const a of assignments) {
        for (const pa of a.positionAssignments) {
          const player = playersById.get(pa.playerId);
          expect(
            player,
            `assignment references unknown playerId ${pa.playerId}`,
          ).toBeTruthy();
          const conditions = slotConditionsForAssignment(
            a.treatment,
            pa.position,
          );
          expect(
            playerSatisfies(player, conditions),
            `player ${pa.playerId} (role=${player.get("role")?.value}) at position ${pa.position} of ${a.treatment.name} fails conditions ${JSON.stringify(conditions)}`,
          ).toBe(true);
        }
      }
    });
  });

  test("total assigned players never exceeds input player count", () => {
    forEachScenario(SEED + 4, N, (scenario, { assignments }) => {
      const total = assignments.reduce(
        (sum, a) => sum + a.positionAssignments.length,
        0,
      );
      expect(total).toBeLessThanOrEqual(scenario.players.length);
    });
  });
});
