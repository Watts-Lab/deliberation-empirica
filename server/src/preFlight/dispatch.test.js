// tests to write
// - dispatch assigns a balanced case
// - dispatch respects the payoffs
// - running the dispatch twice changes the payoff function persistently

import { test, expect } from "vitest";
import { makeDispatcher } from "./dispatch";

class MockPlayer {
  constructor(id, responses) {
    this.id = id;
    this.responses = responses;
  }

  get(key) {
    return this.responses[key];
  }
}

test("demo1", () => {
  const dispatch = makeDispatcher({
    treatments: [
      { name: "onePlayer", playerCount: 1 },
      { name: "twoPlayer", playerCount: 2 },
    ],
    payoffs: [1, 2],
    knockdowns: 1,
  });

  const players = [
    new MockPlayer("p1", {}),
    new MockPlayer("p2", {}),
    new MockPlayer("p3", {}),
  ];

  const assignments = dispatch(players);
  console.log("Assignments", JSON.stringify(assignments));

  // two games
  expect(assignments.length).toBe(2);

  // one two player game and one one player game
  expect(
    assignments.filter((x) => x.treatment.name === "twoPlayer").length
  ).toBe(1);

  expect(
    assignments.filter((x) => x.treatment.name === "onePlayer").length
  ).toBe(1);

  // two player games should have two players
  expect(
    assignments
      .filter((x) => x.treatment.name === "twoPlayer")
      .every((x) => x.positionAssignments.length === 2)
  ).toBe(true);

  // one player games should have one players
  expect(
    assignments
      .filter((x) => x.treatment.name === "onePlayer")
      .every((x) => x.positionAssignments.length === 1)
  ).toBe(true);
});
