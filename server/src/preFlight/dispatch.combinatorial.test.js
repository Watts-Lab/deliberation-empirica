// Combinatorial dispatcher coverage — addresses #38.
//
// Existing dispatch.test.js is scenario-driven (each test pins a specific
// real-world configuration). The dispatcher's contract is combinatorial:
// for any (N players, treatment-set, payoffs, knockdowns,
// requiredFractionOfMaximumPayoff, eligibility) it must produce
// assignments respecting playerCount, condition eligibility, and the
// payoff/knockdown trade-off. This file exercises cells the
// scenario-driven suite skips: edge counts, knockdown shapes (array +
// matrix + mixed), requiredFractionOfMaximumPayoff at boundaries,
// pinch-point eligibility patterns, and multi-position groups with mixed
// conditional/unconditional slots.
//
// Conventions:
// - one-line comment per test naming the combination under test
// - test names describe the combination, not "test N"
// - vitest (matches the sibling file)

import { describe, test, expect } from "vitest";
import { makeDispatcher } from "./dispatch";

// Same MockPlayer shape as dispatch.test.js — see that file for the
// rationale on `{ value }` wrapping vs plain nested objects.
class MockPlayer {
  constructor(id, responses) {
    this.id = id;
    this.responses = responses;
  }

  get(key) {
    const val = this.responses[key];
    if (val === undefined) return undefined;
    if (val !== null && typeof val === "object") return val;
    return { value: val };
  }
}

// Helper to manufacture N unconstrained players quickly.
const makePlayers = (n, makeResponses = () => ({})) =>
  Array.from(
    { length: n },
    (_, i) => new MockPlayer(`p${i}`, makeResponses(i)),
  );

// ---------------------------------------------------------------------------
// Edge counts — boundary behavior at 0/1/exact-fit/just-short.
// ---------------------------------------------------------------------------
describe("edge counts", () => {
  // Zero players in: dispatcher must return zero assignments without crashing.
  test("0 players → 0 assignments", () => {
    const dispatch = makeDispatcher({
      treatments: [{ name: "T", playerCount: 2 }],
      payoffs: [1],
      knockdowns: 1,
    });

    const { assignments } = dispatch([]);
    expect(assignments).toEqual([]);
  });

  // playerCount-1 players for the only treatment: no game possible, no
  // assignments produced (and no crash in the validator that asserts each
  // game has the right number of players).
  test("playerCount-1 players for only treatment → 0 assignments", () => {
    const dispatch = makeDispatcher({
      treatments: [{ name: "T", playerCount: 3 }],
      payoffs: [1],
      knockdowns: 1,
    });

    const { assignments } = dispatch(makePlayers(2));
    expect(assignments).toEqual([]);
  });

  // Exactly playerCount players for the only treatment: one full game,
  // every player assigned exactly once.
  test("exactly playerCount players for only treatment → 1 game using all", () => {
    const dispatch = makeDispatcher({
      treatments: [{ name: "T", playerCount: 4 }],
      payoffs: [1],
      knockdowns: 1,
    });

    const players = makePlayers(4);
    const { assignments } = dispatch(players);

    expect(assignments).toHaveLength(1);
    expect(assignments[0].treatment.name).toBe("T");
    expect(assignments[0].positionAssignments).toHaveLength(4);
    const ids = assignments[0].positionAssignments.map((a) => a.playerId);
    expect(new Set(ids).size).toBe(4);
    expect(new Set(ids)).toEqual(new Set(players.map((p) => p.id)));
  });

  // 1-player treatment with a per-position condition: only eligible
  // players get assigned (singleton groups still respect groupComposition
  // — the playerCount=1 unconstrained branch at dispatch.test.js:402
  // doesn't exercise this).
  test("playerCount=1 treatment with conditional slot → only eligible players assigned", () => {
    const dispatch = makeDispatcher({
      treatments: [
        {
          name: "solo",
          playerCount: 1,
          groupComposition: [
            {
              position: 0,
              conditions: [
                {
                  reference: "self.prompt.role",
                  comparator: "equals",
                  value: "in",
                },
              ],
            },
          ],
        },
      ],
      payoffs: [1],
      knockdowns: 1,
    });

    const players = [
      new MockPlayer("p0", { prompt_role: "in" }),
      new MockPlayer("p1", { prompt_role: "out" }),
      new MockPlayer("p2", { prompt_role: "in" }),
      new MockPlayer("p3", { prompt_role: "out" }),
    ];

    const { assignments } = dispatch(players);

    // Two eligible players → two solo games. p1/p3 stay unassigned.
    expect(assignments).toHaveLength(2);
    const assignedIds = assignments.flatMap((a) =>
      a.positionAssignments.map((p) => p.playerId),
    );
    expect(new Set(assignedIds)).toEqual(new Set(["p0", "p2"]));
  });
});

// ---------------------------------------------------------------------------
// Knockdown shapes — single is well-tested in dispatch.test.js. Array
// (per-treatment decay) and matrix (cross-treatment decay) shapes are
// declared in the dispatch.js comment block but never exercised in tests.
// ---------------------------------------------------------------------------
describe("knockdown shapes", () => {
  // Array-form knockdowns: each treatment decays by its own rate when
  // selected. Treatment with knockdown=1 (no decay) should be picked
  // repeatedly even after use; treatment with low knockdown should be
  // picked at most once before its payoff falls below the alternative.
  test("array knockdowns: per-treatment decay rates", () => {
    const dispatch = makeDispatcher({
      treatments: [
        { name: "no_decay", playerCount: 2 },
        { name: "fast_decay", playerCount: 2 },
      ],
      payoffs: [1, 1],
      // no_decay stays at 1; fast_decay drops to 0.1 after first use.
      knockdowns: [1, 0.1],
    });

    const { assignments } = dispatch(makePlayers(8));

    // 4 games total; no_decay should dominate because its payoff never
    // falls below fast_decay's knocked-down 0.1. fast_decay can run at
    // most once (its first use; afterward 0.1 < 1).
    expect(assignments).toHaveLength(4);
    const fastCount = assignments.filter(
      (a) => a.treatment.name === "fast_decay",
    ).length;
    expect(fastCount).toBeLessThanOrEqual(1);
    expect(
      assignments.filter((a) => a.treatment.name === "no_decay").length,
    ).toBeGreaterThanOrEqual(3);
  });

  // Matrix knockdowns: selecting one treatment can suppress *another's*
  // payoff. With a symmetric "instant suppression" matrix, picking either
  // treatment collapses both X's and Y's payoffs to 0.001 — so the *first*
  // game's pick is unconstrained, and subsequent games could in principle
  // pick either (since both are equally suppressed). The contract this
  // test pins is the suppression effect, not exclusivity of one type.
  test("matrix knockdowns: cross-treatment suppression", () => {
    const dispatch = makeDispatcher({
      treatments: [
        { name: "X", playerCount: 2 },
        { name: "Y", playerCount: 2 },
      ],
      payoffs: [1, 1],
      // Picking X collapses both X and Y; same for Y. After one game of
      // either type, both payoffs are ~0 and the dispatcher should have
      // no preference, but neither will exceed 1, so the *first* pick
      // dominates. The dispatcher tries both branches and picks the
      // better partial — both yield identical payoff structure.
      knockdowns: [
        [0.001, 0.001],
        [0.001, 0.001],
      ],
    });

    const { assignments } = dispatch(makePlayers(8));

    // 4 games created. With matrix [0.001 across the board], every
    // treatment payoff goes to ~0 after any pick, so subsequent games
    // pay ~0 regardless of treatment — the dispatcher just fills slots.
    expect(assignments).toHaveLength(4);
    // Sanity: every assignment is one of the declared treatments.
    assignments.forEach((a) => {
      expect(["X", "Y"]).toContain(a.treatment.name);
      expect(a.positionAssignments).toHaveLength(2);
    });
  });

  // Mixing knockdown=1 (no decay) with knockdown<1 in array form: the
  // no-decay treatment's payoff is preserved across uses, so when its
  // base payoff is also higher, it should be picked exclusively.
  test("array knockdowns: knockdown=1 + higher base payoff → exclusive use", () => {
    const dispatch = makeDispatcher({
      treatments: [
        { name: "premium", playerCount: 2 },
        { name: "fallback", playerCount: 2 },
      ],
      payoffs: [2, 1],
      knockdowns: [1, 0.5], // premium never decays; fallback halves on use
    });

    const { assignments } = dispatch(makePlayers(6));

    // 3 games of premium (payoff 2 each, never decays) beats any
    // mixture using fallback (max 1).
    expect(assignments).toHaveLength(3);
    expect(assignments.every((a) => a.treatment.name === "premium")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// requiredFractionOfMaximumPayoff — the early-stop knob. Default is 0.9.
// At boundaries the search either exits earlier (low threshold) or
// continues past adequate solutions (high threshold). The contract we
// can verify: the returned assignment is *always* a valid solution
// (every game fully staffed, every player at most once); the threshold
// only governs how hard the search worked.
// ---------------------------------------------------------------------------
describe("requiredFractionOfMaximumPayoff at boundaries", () => {
  // Threshold = 1.0 forces the search to keep exploring until it finds
  // a globally-optimal solution (or hits maxIter). For a small, easily-
  // solvable scenario, we should still get the correct full assignment.
  test("requiredFractionOfMaximumPayoff = 1.0 still produces valid assignment", () => {
    const dispatch = makeDispatcher({
      treatments: [
        { name: "A", playerCount: 2 },
        { name: "B", playerCount: 2 },
      ],
      payoffs: [1, 1],
      knockdowns: 0.9,
      requiredFractionOfMaximumPayoff: 1.0,
    });

    const { assignments } = dispatch(makePlayers(4));

    expect(assignments).toHaveLength(2);
    // Both unique treatments used (knockdown distributes them).
    expect(new Set(assignments.map((a) => a.treatment.name)).size).toBe(2);
    assignments.forEach((a) => {
      expect(a.positionAssignments).toHaveLength(2);
    });
  });

  // Threshold = 0.5 lets the search exit on a "good enough" solution
  // after minIter. Result is still valid — every game is fully staffed
  // and no player is double-assigned — even if a globally-better solution
  // existed.
  test("requiredFractionOfMaximumPayoff = 0.5 still produces valid assignment", () => {
    const dispatch = makeDispatcher({
      treatments: [
        { name: "A", playerCount: 2 },
        { name: "B", playerCount: 2 },
      ],
      payoffs: [1, 1],
      knockdowns: 0.9,
      requiredFractionOfMaximumPayoff: 0.5,
    });

    const players = makePlayers(4);
    const { assignments } = dispatch(players);

    expect(assignments.length).toBeGreaterThan(0);
    // Every assignment is fully staffed.
    assignments.forEach((a) => {
      expect(a.positionAssignments).toHaveLength(a.treatment.playerCount);
    });
    // No player is double-assigned.
    const allIds = assignments.flatMap((a) =>
      a.positionAssignments.map((p) => p.playerId),
    );
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});

// ---------------------------------------------------------------------------
// Eligibility patterns — pinch points where eligibility and capacity
// interact. Existing tests cover "everyone eligible for everything" and
// "one or two ineligible". These exercise asymmetric cases.
// ---------------------------------------------------------------------------
describe("eligibility patterns", () => {
  // One scarce specialist eligible for `specialist_only` and a pool of
  // generalists eligible for `generalist_only`. With only one specialist
  // and `specialist_only` requiring two, that treatment can't be staffed,
  // so the dispatcher must form generalist games and leave the specialist
  // unassigned. Contract: every assignment is staffed by players who
  // satisfy the slot's conditions — never a wrong-role placement.
  test("one specialist + many generalists: every slot's conditions are satisfied", () => {
    const dispatch = makeDispatcher({
      treatments: [
        {
          name: "specialist_only",
          playerCount: 2,
          groupComposition: [
            {
              position: 0,
              conditions: [
                {
                  reference: "self.prompt.role",
                  comparator: "equals",
                  value: "specialist",
                },
              ],
            },
            {
              position: 1,
              conditions: [
                {
                  reference: "self.prompt.role",
                  comparator: "equals",
                  value: "specialist",
                },
              ],
            },
          ],
        },
        {
          name: "generalist_only",
          playerCount: 2,
          groupComposition: [
            {
              position: 0,
              conditions: [
                {
                  reference: "self.prompt.role",
                  comparator: "equals",
                  value: "generalist",
                },
              ],
            },
            {
              position: 1,
              conditions: [
                {
                  reference: "self.prompt.role",
                  comparator: "equals",
                  value: "generalist",
                },
              ],
            },
          ],
        },
      ],
      payoffs: [1, 1],
      knockdowns: 0.9,
    });

    const players = [
      new MockPlayer("s0", { prompt_role: "specialist" }),
      ...Array.from(
        { length: 5 },
        (_, i) => new MockPlayer(`g${i}`, { prompt_role: "generalist" }),
      ),
    ];

    const { assignments } = dispatch(players);

    // Generalists: 5 → 2 games of 2, with 1 generalist left over.
    // Specialist: solo, can't fill specialist_only (needs 2).
    // So we expect exactly 2 generalist games and 0 specialist games.
    expect(assignments).toHaveLength(2);
    expect(
      assignments.every((a) => a.treatment.name === "generalist_only"),
    ).toBe(true);

    // Every assigned player is a generalist (specialist must not slip
    // into a generalist slot).
    const assignedIds = assignments.flatMap((a) =>
      a.positionAssignments.map((p) => p.playerId),
    );
    assignedIds.forEach((id) => {
      const player = players.find((p) => p.id === id);
      expect(player.responses.prompt_role).toBe("generalist");
    });
  });

  // "Cyclic" eligibility: each player is eligible for exactly one slot
  // in exactly one treatment, and the slots form a closed cycle. The
  // unique solution is the assignment that respects the cycle. This is
  // a pinch-point case where the search has no flexibility.
  test("cyclic eligibility: each player matches exactly one slot", () => {
    const dispatch = makeDispatcher({
      treatments: [
        {
          name: "T1",
          playerCount: 2,
          groupComposition: [
            {
              position: 0,
              conditions: [
                {
                  reference: "self.prompt.tag",
                  comparator: "equals",
                  value: "A",
                },
              ],
            },
            {
              position: 1,
              conditions: [
                {
                  reference: "self.prompt.tag",
                  comparator: "equals",
                  value: "B",
                },
              ],
            },
          ],
        },
        {
          name: "T2",
          playerCount: 2,
          groupComposition: [
            {
              position: 0,
              conditions: [
                {
                  reference: "self.prompt.tag",
                  comparator: "equals",
                  value: "C",
                },
              ],
            },
            {
              position: 1,
              conditions: [
                {
                  reference: "self.prompt.tag",
                  comparator: "equals",
                  value: "D",
                },
              ],
            },
          ],
        },
      ],
      payoffs: [1, 1],
      knockdowns: 0.9,
    });

    const players = [
      new MockPlayer("pA", { prompt_tag: "A" }),
      new MockPlayer("pB", { prompt_tag: "B" }),
      new MockPlayer("pC", { prompt_tag: "C" }),
      new MockPlayer("pD", { prompt_tag: "D" }),
    ];

    const { assignments } = dispatch(players);

    // Unique valid solution: pA→T1[0], pB→T1[1], pC→T2[0], pD→T2[1].
    expect(assignments).toHaveLength(2);
    const t1 = assignments.find((a) => a.treatment.name === "T1");
    const t2 = assignments.find((a) => a.treatment.name === "T2");
    expect(t1).toBeDefined();
    expect(t2).toBeDefined();

    expect(t1.positionAssignments.find((p) => p.position === 0).playerId).toBe(
      "pA",
    );
    expect(t1.positionAssignments.find((p) => p.position === 1).playerId).toBe(
      "pB",
    );
    expect(t2.positionAssignments.find((p) => p.position === 0).playerId).toBe(
      "pC",
    );
    expect(t2.positionAssignments.find((p) => p.position === 1).playerId).toBe(
      "pD",
    );
  });
});

// ---------------------------------------------------------------------------
// Multi-position groupComposition — the existing constrained tests exercise
// 2-3 position treatments. These cover multi-position groups with mixed
// conditional/unconditional slots, which is a documented pattern in
// constrainedTreatments() but isn't tested in isolation.
// ---------------------------------------------------------------------------
describe("multi-position groupComposition", () => {
  // 4-position treatment, only some positions have conditions. Players
  // who satisfy the constrained positions must land there; unconstrained
  // positions can take anyone. Contract verified: every constrained slot
  // is filled by an eligible player.
  test("4-position treatment with mixed constrained/unconstrained slots", () => {
    const dispatch = makeDispatcher({
      treatments: [
        {
          name: "mixed",
          playerCount: 4,
          groupComposition: [
            {
              position: 0,
              conditions: [
                {
                  reference: "self.prompt.role",
                  comparator: "equals",
                  value: "lead",
                },
              ],
            },
            {
              position: 1,
              conditions: [
                {
                  reference: "self.prompt.role",
                  comparator: "equals",
                  value: "support",
                },
              ],
            },
            { position: 2 }, // unconstrained
            { position: 3 }, // unconstrained
          ],
        },
      ],
      payoffs: [1],
      knockdowns: 1,
    });

    const players = [
      new MockPlayer("lead", { prompt_role: "lead" }),
      new MockPlayer("support", { prompt_role: "support" }),
      new MockPlayer("filler1", { prompt_role: "other" }),
      new MockPlayer("filler2", { prompt_role: "other" }),
    ];

    const { assignments } = dispatch(players);

    expect(assignments).toHaveLength(1);
    const game = assignments[0];

    // Constrained positions must be filled by eligible players.
    const lead = game.positionAssignments.find((p) => p.position === 0);
    const support = game.positionAssignments.find((p) => p.position === 1);
    expect(lead.playerId).toBe("lead");
    expect(support.playerId).toBe("support");

    // Unconstrained positions get the remaining players (any order).
    const fillerIds = game.positionAssignments
      .filter((p) => p.position === 2 || p.position === 3)
      .map((p) => p.playerId);
    expect(new Set(fillerIds)).toEqual(new Set(["filler1", "filler2"]));
  });

  // 3-position treatment where every position has *different* conditions
  // and the candidate pool exactly equals the slot demands. Pure
  // assignment problem: each player satisfies exactly one position.
  test("3-position treatment with one player per position (exact-fit eligibility)", () => {
    const dispatch = makeDispatcher({
      treatments: [
        {
          name: "triad",
          playerCount: 3,
          groupComposition: [
            {
              position: 0,
              conditions: [
                {
                  reference: "self.prompt.color",
                  comparator: "equals",
                  value: "red",
                },
              ],
            },
            {
              position: 1,
              conditions: [
                {
                  reference: "self.prompt.color",
                  comparator: "equals",
                  value: "green",
                },
              ],
            },
            {
              position: 2,
              conditions: [
                {
                  reference: "self.prompt.color",
                  comparator: "equals",
                  value: "blue",
                },
              ],
            },
          ],
        },
      ],
      payoffs: [1],
      knockdowns: 1,
    });

    const players = [
      new MockPlayer("r", { prompt_color: "red" }),
      new MockPlayer("g", { prompt_color: "green" }),
      new MockPlayer("b", { prompt_color: "blue" }),
    ];

    const { assignments } = dispatch(players);

    expect(assignments).toHaveLength(1);
    const game = assignments[0];
    expect(
      game.positionAssignments.find((p) => p.position === 0).playerId,
    ).toBe("r");
    expect(
      game.positionAssignments.find((p) => p.position === 1).playerId,
    ).toBe("g");
    expect(
      game.positionAssignments.find((p) => p.position === 2).playerId,
    ).toBe("b");
  });
});
