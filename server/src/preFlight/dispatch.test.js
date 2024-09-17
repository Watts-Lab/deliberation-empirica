import { test, expect } from "vitest";
import { makeDispatcher } from "./dispatch";

class MockPlayer {
  constructor(id, responses) {
    this.id = id;
    this.responses = responses;
  }

  get(key) {
    return { value: this.responses[key] };
  }
}

test("prioritizes high payoff when all players are eligible for all slots", () => {
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
    new MockPlayer("p4", {}),
    new MockPlayer("p5", {}),
  ];

  const { assignments } = dispatch(players);

  // three games
  expect(assignments.length).toBe(3);

  // one two player game and one one player game
  expect(
    assignments.filter((x) => x.treatment.name === "twoPlayer").length
  ).toBe(2);

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

test("uses knockdown to distribute between treatments", () => {
  const dispatch = makeDispatcher({
    treatments: [
      { name: "A", playerCount: 2 },
      { name: "B", playerCount: 2 },
      { name: "C", playerCount: 2 },
      { name: "D", playerCount: 2 },
      { name: "E", playerCount: 2 },
    ],
    payoffs: [1, 1, 1, 1, 1],
    knockdowns: 0.9,
  });

  const players = [
    new MockPlayer("p1", {}),
    new MockPlayer("p2", {}),
    new MockPlayer("p3", {}),
    new MockPlayer("p4", {}),
    new MockPlayer("p5", {}),
    new MockPlayer("p6", {}),
    new MockPlayer("p7", {}),
    new MockPlayer("p8", {}),
    new MockPlayer("p9", {}),
    new MockPlayer("p10", {}),
  ];

  const { assignments } = dispatch(players);
  // console.log("Assignments", JSON.stringify(assignments, null, "\t"));

  // correct number of games created
  expect(assignments.length).toBe(5);

  // Exactly one of each treatment
  expect(assignments.filter((x) => x.treatment.name === "A").length).toBe(1);
  expect(assignments.filter((x) => x.treatment.name === "B").length).toBe(1);
  expect(assignments.filter((x) => x.treatment.name === "C").length).toBe(1);
  expect(assignments.filter((x) => x.treatment.name === "D").length).toBe(1);
  expect(assignments.filter((x) => x.treatment.name === "E").length).toBe(1);
});

test("assigns players to slots they are eligible for", () => {
  const dispatch = makeDispatcher({
    treatments: [
      {
        name: "A",
        playerCount: 2,
        groupComposition: [
          {
            position: 0,
            conditions: [
              { reference: "prompt.alpha", comparator: "equals", value: "1" },
              { reference: "prompt.beta", comparator: "equals", value: "2" },
            ],
          },
          {
            position: 1,
            conditions: [
              { reference: "prompt.alpha", comparator: "equals", value: "3" },
              { reference: "prompt.beta", comparator: "equals", value: "4" },
            ],
          },
        ],
      },
      {
        name: "B",
        playerCount: 2,
        groupComposition: [
          {
            position: 0,
            conditions: [
              { reference: "prompt.alpha", comparator: "equals", value: "1" },
              { reference: "prompt.beta", comparator: "equals", value: "5" },
            ],
          },
          {
            position: 1,
            conditions: [
              { reference: "prompt.alpha", comparator: "equals", value: "3" },
              { reference: "prompt.beta", comparator: "equals", value: "6" },
            ],
          },
        ],
      },
    ],
    payoffs: [1, 1],
    knockdowns: 0.9,
  });

  const players = [
    new MockPlayer("p1", { prompt_alpha: "1", prompt_beta: "2" }),
    new MockPlayer("p2", { prompt_alpha: "3", prompt_beta: "4" }),
    new MockPlayer("p3", { prompt_alpha: "1", prompt_beta: "2" }),
    new MockPlayer("p4", { prompt_alpha: "3", prompt_beta: "4" }),
  ];

  const { assignments } = dispatch(players);
  // console.log("Assignments", JSON.stringify(assignments, null, "\t"));

  // two games
  expect(assignments.length).toBe(2);

  // both of the same treatment
  expect(assignments.filter((x) => x.treatment.name === "A").length).toBe(2);
});

// Test that it works with no payoffs or knockdowns supplied
test("works with payoffs equal and no knockdowns", () => {
  // it should still
  const dispatch = makeDispatcher({
    treatments: [
      { name: "A", playerCount: 2 },
      { name: "B", playerCount: 2 },
    ],
    payoffs: "equal",
    knockdowns: "none",
  });

  const players = [
    new MockPlayer("p1", {}),
    new MockPlayer("p2", {}),
    new MockPlayer("p3", {}),
    new MockPlayer("p4", {}),
  ];

  const { assignments } = dispatch(players);
  // console.log("Assignments", JSON.stringify(assignments, null, "\t"));

  // correct number of games created
  expect(assignments.length).toBe(2);
});

// todo: test that the dispatch persists the payoff function
test("persists changes to the payoffs to enable distribution across treatments between dispatch runs", () => {
  const dispatch = makeDispatcher({
    treatments: [
      { name: "A", playerCount: 2 },
      { name: "B", playerCount: 2 },
      { name: "C", playerCount: 2 },
      { name: "D", playerCount: 2 },
      { name: "E", playerCount: 2 },
    ],
    payoffs: [1, 1, 1, 1, 1],
    knockdowns: 0.9,
  });

  const players = [
    new MockPlayer("p1", {}),
    new MockPlayer("p2", {}),
    new MockPlayer("p3", {}),
    new MockPlayer("p4", {}),
    new MockPlayer("p5", {}),
    new MockPlayer("p6", {}),
    new MockPlayer("p7", {}),
    new MockPlayer("p8", {}),
    new MockPlayer("p9", {}),
    new MockPlayer("p10", {}),
  ];

  const assignments = [];
  assignments.push(...dispatch(players.slice(0, 4)).assignments);
  assignments.push(...dispatch(players.slice(4, 8)).assignments);
  assignments.push(...dispatch(players.slice(8, 10)).assignments);
  // console.log("Assignments", JSON.stringify(assignments, null, "\t"));

  // correct number of games created
  expect(assignments.length).toBe(5);

  // Exactly one of each treatment
  expect(assignments.filter((x) => x.treatment.name === "A").length).toBe(1);
  expect(assignments.filter((x) => x.treatment.name === "B").length).toBe(1);
  expect(assignments.filter((x) => x.treatment.name === "C").length).toBe(1);
  expect(assignments.filter((x) => x.treatment.name === "D").length).toBe(1);
  expect(assignments.filter((x) => x.treatment.name === "E").length).toBe(1);
});

test("does not assign ineligible or leftover players", () => {
  const dispatch = makeDispatcher({
    treatments: [
      {
        name: "A",
        playerCount: 2,
        groupComposition: [
          {
            position: 0,
            conditions: [
              { reference: "prompt.alpha", comparator: "equals", value: "1" },
              { reference: "prompt.beta", comparator: "equals", value: "2" },
            ],
          },
          {
            position: 1,
            conditions: [
              { reference: "prompt.alpha", comparator: "equals", value: "3" },
              { reference: "prompt.beta", comparator: "equals", value: "4" },
            ],
          },
        ],
      },
      {
        name: "B",
        playerCount: 2,
        groupComposition: [
          {
            position: 0,
            conditions: [
              { reference: "prompt.alpha", comparator: "equals", value: "1" },
              { reference: "prompt.beta", comparator: "equals", value: "5" },
            ],
          },
          {
            position: 1,
            conditions: [
              { reference: "prompt.alpha", comparator: "equals", value: "3" },
              { reference: "prompt.beta", comparator: "equals", value: "6" },
            ],
          },
        ],
      },
    ],
    payoffs: [1, 1],
    knockdowns: 0.9,
  });

  const players = [
    new MockPlayer("p1", { prompt_alpha: "1", prompt_beta: "2" }),
    new MockPlayer("p2", { prompt_alpha: "3", prompt_beta: "4" }),
    new MockPlayer("p3", { prompt_alpha: "7", prompt_beta: "9" }),
    new MockPlayer("p4", { prompt_alpha: "3", prompt_beta: "4" }),
  ];

  const { assignments } = dispatch(players);
  // console.log("Assignments", JSON.stringify(assignments, null, "\t"));

  // only one game is filled
  expect(assignments.length).toBe(1);

  // assigned to treatment A
  expect(assignments.filter((x) => x.treatment.name === "A").length).toBe(1);
});

// test that a three player game is created if there are three players left over
test("groups of three fill batch when payoff is high enough", () => {
  const dispatch = makeDispatcher({
    treatments: [
      { name: "A", playerCount: 2 },
      { name: "B", playerCount: 3 },
    ],
    payoffs: [1, 0.8],
    knockdowns: 1,
  });

  const players = [
    new MockPlayer("p1", {}),
    new MockPlayer("p2", {}),
    new MockPlayer("p3", {}),
    new MockPlayer("p4", {}),
    new MockPlayer("p5", {}),
    new MockPlayer("p6", {}),
    new MockPlayer("p7", {}),
  ];

  const { assignments } = dispatch(players);

  // correct number of games created
  expect(assignments.length).toBe(3);

  // Exactly one of each treatment
  expect(assignments.filter((x) => x.treatment.name === "A").length).toBe(2);
  expect(assignments.filter((x) => x.treatment.name === "B").length).toBe(1);
});

// test that if payoff for a three player game is less than 2/3 of the payoff for a two player game, the three player game is not created
test("it can be preferable not to assign a player if the opportunity cost is too high", () => {
  const dispatch = makeDispatcher({
    treatments: [
      { name: "A", playerCount: 2 },
      { name: "B", playerCount: 3 },
    ],
    payoffs: [1, 0.5],
    knockdowns: 1,
  });

  const players = [
    new MockPlayer("p1", {}),
    new MockPlayer("p2", {}),
    new MockPlayer("p3", {}),
    new MockPlayer("p4", {}),
    new MockPlayer("p5", {}),
    new MockPlayer("p6", {}),
    new MockPlayer("p7", {}),
  ];

  const { assignments } = dispatch(players);

  // correct number of games created
  expect(assignments.length).toBe(3);

  // Exactly one of each treatment
  expect(assignments.filter((x) => x.treatment.name === "A").length).toBe(3);
});

test("one-person games", () => {
  const dispatch = makeDispatcher({
    treatments: [{ name: "A", playerCount: 1 }],
    payoffs: [1],
    knockdowns: 1,
  });

  const players = [
    new MockPlayer("p1", {}),
    new MockPlayer("p2", {}),
    new MockPlayer("p3", {}),
    new MockPlayer("p4", {}),
    new MockPlayer("p5", {}),
    new MockPlayer("p6", {}),
    new MockPlayer("p7", {}),
  ];

  const { assignments } = dispatch(players);

  // correct number of games created
  expect(assignments.length).toBe(7);

  // Exactly one of each treatment
  expect(assignments.filter((x) => x.treatment.name === "A").length).toBe(7);
});

// helper function to get a random integer
function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

const testLargeDispatch = () => {
  const treatments = [];
  for (let i = 0; i < 300; i++) {
    const playerCount = getRandomInt(4) + 2;
    const groupComposition = [];
    for (let j = 0; j < playerCount; j++) {
      groupComposition.push({
        position: j,
        conditions: [
          {
            reference: "prompt.alpha",
            comparator: "equals",
            value: `${getRandomInt(15)}`,
          },
        ],
      });
    }

    treatments.push({
      name: `treatment${i}`,
      playerCount,
      groupComposition,
    });
  }

  const players = [];
  for (let i = 0; i < 800; i++) {
    players.push(
      new MockPlayer(`p_${i}`, { prompt_alpha: `${getRandomInt(15)}` })
    );
  }

  const dispatch = makeDispatcher({
    treatments,
    payoffs: "equal",
    knockdowns: "none",
  });

  const startTime = Date.now();
  dispatch(players);
  const endTime = Date.now();
  const timeTaken = (endTime - startTime) / 1000;

  return timeTaken;
};

// test("large dispatch", () => {
//   const timeTaken = test_large_dispatch();
//   console.log("Time taken", timeTaken);

//   expect(timeTaken).toBeLessThan(1);
// });

const average = (array) => array.reduce((a, b) => a + b) / array.length;

test("profile large dispatch", () => {
  const timeTaken = [];
  for (let i = 0; i < 20; i++) {
    timeTaken.push(testLargeDispatch());
  }
  const averageTime = average(timeTaken);

  console.log("Time taken", timeTaken);
  console.log("Average time", averageTime);

  expect(averageTime).toBeLessThan(1);
});
