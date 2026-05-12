/* eslint-disable no-bitwise, no-restricted-syntax */
// `no-bitwise` is disabled because mulberry32 uses bit ops by
// design (PRNG, intentional). `no-restricted-syntax` is disabled
// because the invariant checks use `for...of` over assignment
// arrays — `.every()` would obscure which item failed (no early
// return preserves the assertion message via expect()).

import { vi, describe, test, expect, afterAll } from "vitest";

// Dispatcher INTERFACE-CONTRACT tests. Pin the structural invariants
// that every dispatcher implementation must satisfy — the bits the
// algorithm-specific scenario tests can't catch because they only
// probe specific points in the input space, AND that future
// alternative algorithms must also uphold to qualify as a dispatcher
// at all.
//
// Strategy: a deterministic PRNG (mulberry32) drives a generator
// that produces random batches of (players, treatments,
// algorithm-params), and each test asserts an invariant over every
// dispatch result. The harness is parameterized over a dispatcher
// FACTORY so any new algorithm gets pulled into the same gauntlet
// just by registering its factory below.
//
// What this covers vs. what the existing tests cover:
//   - dispatch.test.js: hand-picked scenarios (cypress-derived)
//   - dispatch.combinatorial.test.js: combinatorial axes (PR #67)
//   - this file: random combinations across those axes, asserting
//     contract-level invariants against EVERY registered dispatcher
//
// See the JSDoc on `makeDispatcher` in dispatch.js for the canonical
// interface contract.

// Mute @empirica/core/console + the stray `console.log("knockdownType",
// ...)` in dispatch.js — this suite calls makeDispatcher / dispatch
// roughly 1000× per registered dispatcher and the noise dwarfs the
// signal in CI. Mirrors the pattern in exportParticipantData.test.js.
//
// IMPORTANT: this `vi.mock` block must literally appear above the
// SUT import below. Vitest does hoist `vi.mock` calls, but keeping
// the source order matches the runtime order so future readers don't
// have to reason about hoisting. The console.log spy is restored in
// `afterAll` (see below) so this file doesn't leak the mute into
// other tests in the same Vitest worker.
vi.mock("@empirica/core/console", () => ({
  info: () => {},
  warn: () => {},
  error: () => {},
  log: () => {},
}));
vi.spyOn(console, "log").mockImplementation(() => {});

afterAll(() => {
  vi.restoreAllMocks();
});

// eslint-disable-next-line import/first
import { makeDispatcher } from "./dispatch";

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
      reference: "self.prompt.role",
      comparator: "equals",
      value: pick(rng, ROLES),
    },
  ];
}

function genTreatment(rng, idx) {
  const playerCount = intRange(rng, 1, 4);
  // Treatment-level `conditions` (without groupComposition) are
  // silently ignored by the dispatcher — see dispatch.js which only
  // reads `treatment.groupComposition?.[position].conditions`.
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
  // `payoffs` and `knockdowns` are payoff-knockdown-algorithm-
  // specific. The harness keeps them on the scenario object because
  // (today) the only registered dispatcher consumes them; future
  // dispatchers will ignore them and pull from their own params on
  // the scenario. The factory signature handles this — each
  // dispatcher's adapter pulls only the fields it cares about.
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
    // stagebook 0.10+ requires references to carry a position selector
    // prefix (`self`, `shared`, `all`, or a numeric slot index). The
    // generator emits `self.prompt.role` because the conditions get
    // evaluated against the player in that slot.
    if (c.reference !== "self.prompt.role" || c.comparator !== "equals") {
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

// Format the seed+scenario+algorithm context for assertion failures
// or dispatcher throws. Same shape used in both paths so a repro is
// easy regardless of which side blew up.
function formatContext(algorithm, seed, scenarioIdx, scenario) {
  return `[algorithm=${algorithm} seed=0x${seed.toString(16)} scenario=${scenarioIdx}]\nscenario: ${JSON.stringify(
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

// Deep-clone helper for input-immutability checks. JSON round-trip
// is fine here because scenario inputs are plain JSON-serializable
// shapes (treatments, payoffs, knockdowns); we check player
// `responses` separately because MockPlayer wraps them in a class
// instance.
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Run the dispatcher over a deterministic list of N scenarios + run
// an invariant check per scenario. Both invariant violations AND
// dispatcher throws fail the test, with the algorithm + seed + scenario
// context in the assertion message. We do NOT silently swallow throws
// — the generator is designed to produce valid inputs, so a throw
// indicates either a real dispatcher bug or a generator gap worth
// surfacing.
//
// `algorithm` is the registered name of the dispatcher under test.
// `factory(scenario)` returns a constructed dispatcher (function);
// the harness calls it with `scenario.players`.
//
// `opts.snapshot: true` captures pre-dispatch deep-clones of treatments
// and per-player responses BEFORE `factory` and `dispatch` run, and
// passes them to the invariant callback as the 4th argument. Only
// invariant #9 (input immutability) needs this; capturing
// unconditionally would multiply the per-scenario allocation cost by
// ~9× across the suite (and N× more as alternative dispatchers get
// registered). Capturing inside the invariant callback would NOT
// work — the dispatcher has already touched inputs by then, so any
// non-idempotent mutation would slip through silently.
function forEachScenario(algorithm, factory, seed, n, invariant, opts = {}) {
  const rng = makeRng(seed);
  for (let i = 0; i < n; i += 1) {
    const scenario = genScenario(rng);
    const snapshots = opts.snapshot
      ? {
          treatmentsBefore: deepClone(scenario.treatments),
          responsesBefore: scenario.players.map((p) => deepClone(p.responses)),
        }
      : null;
    let dispatch;
    let result;
    try {
      dispatch = factory(scenario);
      result = dispatch(scenario.players);
    } catch (err) {
      err.message = `dispatcher threw: ${err.message}\n${formatContext(algorithm, seed, i, scenario)}`;
      throw err;
    }
    try {
      invariant(scenario, result, i, snapshots);
    } catch (err) {
      err.message = `${err.message}\n${formatContext(algorithm, seed, i, scenario)}`;
      throw err;
    }
  }
}

// Per-dispatcher contract gauntlet. Adding a new dispatcher means
// adding one entry to the list at the bottom of this file; the same
// 10 invariants (plus eventually #11 history round-trip, planned
// for #149 Step 4) run against it automatically.
function runContractSuite(algorithm, factory) {
  describe(`Dispatcher contract: ${algorithm} (seed=0x${SEED.toString(16)}, N=${N})`, () => {
    test("1. every assignment has exactly treatment.playerCount positionAssignments", () => {
      forEachScenario(
        algorithm,
        factory,
        SEED,
        N,
        (scenario, { assignments }) => {
          for (const a of assignments) {
            expect(a.positionAssignments.length).toBe(a.treatment.playerCount);
          }
        },
      );
    });

    test("2. no player id appears in more than one assignment", () => {
      forEachScenario(
        algorithm,
        factory,
        SEED + 1,
        N,
        (scenario, { assignments }) => {
          const seen = new Set();
          for (const a of assignments) {
            for (const pa of a.positionAssignments) {
              expect(seen.has(pa.playerId)).toBe(false);
              seen.add(pa.playerId);
            }
          }
        },
      );
    });

    test("3. every assignment's treatment is from the input set", () => {
      forEachScenario(
        algorithm,
        factory,
        SEED + 2,
        N,
        (scenario, { assignments }) => {
          const validNames = new Set(scenario.treatments.map((t) => t.name));
          for (const a of assignments) {
            expect(validNames.has(a.treatment.name)).toBe(true);
          }
        },
      );
    });

    test("4. every assigned player satisfies the slot conditions they're placed in", () => {
      forEachScenario(
        algorithm,
        factory,
        SEED + 3,
        N,
        (scenario, { assignments }) => {
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
                `player ${pa.playerId} (role=${player.get("prompt_role")?.value}) at position ${pa.position} of ${a.treatment.name} fails conditions ${JSON.stringify(conditions)}`,
              ).toBe(true);
            }
          }
        },
      );
    });

    test("5. total assigned players never exceeds input player count", () => {
      forEachScenario(
        algorithm,
        factory,
        SEED + 4,
        N,
        (scenario, { assignments }) => {
          const total = assignments.reduce(
            (sum, a) => sum + a.positionAssignments.length,
            0,
          );
          expect(total).toBeLessThanOrEqual(scenario.players.length);
        },
      );
    });

    test("6. position uniqueness within an assignment", () => {
      forEachScenario(
        algorithm,
        factory,
        SEED + 5,
        N,
        (scenario, { assignments }) => {
          for (const a of assignments) {
            const positions = a.positionAssignments.map((pa) => pa.position);
            const uniquePositions = new Set(positions);
            expect(
              uniquePositions.size,
              `assignment to ${a.treatment.name} has duplicate positions: ${JSON.stringify(positions)}`,
            ).toBe(positions.length);
          }
        },
      );
    });

    test("7. result has an `assignments` array (algorithm extras allowed but ignored)", () => {
      forEachScenario(algorithm, factory, SEED + 6, N, (scenario, result) => {
        expect(result, "dispatcher returned null/undefined").toBeTruthy();
        expect(
          Array.isArray(result.assignments),
          `result.assignments is not an array: ${typeof result.assignments}`,
        ).toBe(true);
      });
    });

    test("8. empty input → empty assignments (no crash, no null)", () => {
      // Construct a 0-player scenario explicitly (the random generator
      // only emits 0 players occasionally; we want this case pinned
      // unconditionally on every seed run).
      const emptyScenario = {
        players: [],
        treatments: [{ name: "t0", playerCount: 2 }],
        payoffs: [1.0],
        knockdowns: "none",
      };
      const dispatch = factory(emptyScenario);
      const result = dispatch(emptyScenario.players);
      expect(result.assignments).toEqual([]);
    });

    test("9. dispatcher does not mutate input players / treatments", () => {
      // Opt into pre-dispatch snapshots via the `snapshot: true` option
      // — see the comment block on `forEachScenario`. Capturing inside
      // this callback would miss any non-idempotent mutation because
      // the dispatcher has already run by the time we get here. Only
      // this invariant pays the deep-clone cost.
      forEachScenario(
        algorithm,
        factory,
        SEED + 7,
        N,
        (scenario, _result, _idx, { treatmentsBefore, responsesBefore }) => {
          expect(scenario.treatments).toEqual(treatmentsBefore);
          scenario.players.forEach((p, i) => {
            expect(p.responses, `player ${p.id} responses mutated`).toEqual(
              responsesBefore[i],
            );
          });
        },
        { snapshot: true },
      );
    });

    test("10. every position in positionAssignments is in [0, treatment.playerCount)", () => {
      forEachScenario(
        algorithm,
        factory,
        SEED + 8,
        N,
        (scenario, { assignments }) => {
          for (const a of assignments) {
            for (const pa of a.positionAssignments) {
              expect(
                pa.position,
                `position ${pa.position} out of range for ${a.treatment.name} (playerCount=${a.treatment.playerCount})`,
              ).toBeGreaterThanOrEqual(0);
              expect(
                pa.position,
                `position ${pa.position} out of range for ${a.treatment.name} (playerCount=${a.treatment.playerCount})`,
              ).toBeLessThan(a.treatment.playerCount);
            }
          }
        },
      );
    });
  });
}

// ─── Registered dispatchers ───────────────────────────────────────
//
// Adding a new dispatcher to this list runs it through the same 10
// invariants automatically. The factory takes a scenario and returns
// the constructed `dispatch(players)` function — each dispatcher
// pulls only the scenario fields it understands (this dispatcher
// uses payoffs + knockdowns; future ones may use other fields).

runContractSuite("payoff-knockdown", (scenario) =>
  makeDispatcher({
    treatments: scenario.treatments,
    payoffs: scenario.payoffs,
    knockdowns: scenario.knockdowns,
  }),
);
