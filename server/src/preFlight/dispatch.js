/* eslint-disable no-restricted-syntax */
import { info, warn, error } from "@empirica/core/console";
import { compare } from "../utils/comparison";

function shuffle(arr) {
  // randomize the order of an array, returning a new array
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled;
}

function leftovers(target, factors) {
  // Given an integer `target` and a list of integers `factors`,
  // returns the smallest number needed to add to an arbitrary number of factors
  // to sum to `target`.

  // We use this to figure out how many participants we will not be able to assign
  // to games of sizes in `factors`, even if we have optimum and unconstrained assignment.
  let closest = target;
  for (const factor of factors) {
    if (factor === target) return 0;
  }

  for (const factor of factors) {
    if (factor < target) {
      const leftover = leftovers(target - factor, factors);
      if (leftover < closest) {
        closest = leftover;
      }
    }
  }
  return closest;
}

function getMinCost(treatments, nParticipants, noAssignCost) {
  // theoretical minimum cost, assuming we assign participants to the cheapest treatments first, ignoring eligibility
  // we use this as a lower bound to stop the search early if we can't do better than this
  const slotCosts = [];
  for (const treatment of treatments) {
    for (let i = 0; i < treatment.playerCount; i++) {
      slotCosts.push(treatment.cost);
    }
  }

  let minCost = 0;
  const playerCounts = [
    ...new Set(treatments.map((treatment) => treatment.playerCount)),
  ];
  const nUnassignableParticipants = leftovers(nParticipants, playerCounts);

  for (let i = 0; i < nParticipants - nUnassignableParticipants; i++) {
    const currentMinCostSlot = slotCosts.indexOf(Math.min(...slotCosts));
    minCost += slotCosts[currentMinCostSlot];
    slotCosts[currentMinCostSlot] += 1;
  }

  minCost += nUnassignableParticipants * noAssignCost;
  return minCost;
}

function getTheoreticalMaxPayoff(
  treatments,
  payoffs,
  knockdowns,
  nParticipants
) {
  // The theoretical maximum payoff is the sum of the maximum payoffs for each treatment
}

export function makeDispatcher({
  treatments,
  payoffs: payoffsArg,
  knockdowns,
  requiredFractionOfMaximumPayoff = 0.9,
  maxIter = 3000,
  minIter = 100,
}) {
  // Arguments:
  // - treatments: an array of length n of treatment objects taken directly from the treatment file.
  //   Needs to be in the order that the treatment names are specified in the batch config.
  //
  // - payoffs: an array of initial payoffs for each treatment taken from the batch config.
  //
  // - knockdowns: (optional) how much to reduce the payoff for each treatment when another treatment is used. Must be in the range (0, 1].
  //   This can take several forms:
  //   - a single number, in which case the payoff for a treatment is multiplied by this number it is used.
  //   - an array of numbers of length n, in which case the payoff for a treatment is multiplied by the
  //     number at its index in the array once it has been used.
  //   - a matrix of factors by which all treatment payoffs are multiplied when a particular treatment is used.
  //     Rows (first index) are treatments just used, and columns (second index) are the knockdowns for all treatments given the row.
  //   - if undefined, we assume that subsequent payoffs are not affected by the use of any treatments.
  //
  // - requiredFractionOfMaximumPayoff: the fraction of the theoretically maximum possible payoff in order to stop the search before maxIter.
  //
  // - maxIter: the maximum number of iterations to run before stopping the search.
  // - minIter: the minimum number of iterations to run before stopping the search.
  //
  // Returns:
  // - dispatch: a function that will be called every time the dispatch timer expires, and that will assign participants to treatments.

  // Each batch has a single dispatch function that runs multiple times to assign participants to treatments as they arrive
  // we use a closure pattern so that we can persist some state between calls

  if (treatments.length === 0) {
    throw new Error("No treatments specified");
  }

  let persistentPayoffs;
  if (!payoffsArg || payoffsArg.length === 0) {
    warn("No payoffs specified, using default payoffs of 1 for all treatments");
    persistentPayoffs = treatments.map(() => 1);
  } else {
    persistentPayoffs = payoffsArg;
  }

  if (treatments.length !== payoffsArg.length) {
    throw new Error(
      "Number of treatments and payoffs must match, received: ",
      treatments,
      payoffsArg
    );
  }

  // check that knockdowns are properly formatted and save the type for later use
  let knockdownType;
  if (!knockdowns) {
    knockdownType = "none";
  } else if (
    typeof knockdowns === "number" &&
    knockdowns > 0 &&
    knockdowns <= 1
  ) {
    knockdownType = "single";
  } else if (
    Array.isArray(knockdowns) &&
    knockdowns.length === payoffsArg.length &&
    knockdowns.every((f) => typeof f === "number" && f > 0 && f <= 1)
  ) {
    knockdownType = "array";
  } else if (
    Array.isArray(knockdowns) &&
    knockdowns.length === payoffsArg.length &&
    knockdowns.every(
      (f) =>
        Array.isArray(f) &&
        f.length === payoffsArg.length &&
        f.every((ff) => typeof ff === "number" && ff > 0 && ff <= 1)
    )
  ) {
    knockdownType = "matrix";
  } else {
    throw new Error("Invalid knockdown factors, received: ", knockdowns);
  }

  // var persistentTreatmentCosts = treatments.map((treatment) => treatment.cost); // e.g [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]

  const isEligibleCache = new Map();
  function isEligible(players, playerId, treatmentIndex, position) {
    const cacheKey = `${playerId}-${treatmentIndex}-${position}`;
    if (isEligibleCache.has(cacheKey)) {
      return isEligibleCache.get(cacheKey);
    }

    const treatment = treatments[treatmentIndex];
    const candidate = players.filter((p) => p.id === playerId)[0];
    const conditions = treatment.groupComposition?.[position] || [];

    for (const condition of conditions) {
      if (
        !compare(
          candidate[condition.promptName],
          condition.comparator,
          condition.value
        )
      ) {
        isEligibleCache.set(cacheKey, false);
        return false;
      }
    }

    isEligibleCache.set(cacheKey, true);
    return true;
  }

  function knockdown(currentPayoffs, index) {
    // Apply knockdowns to payoffs
    // prevPayoffs: the previous array of payoffs for each treatment
    // index: the index the knockdowns to apply
    // returns: the new array of payoffs
    //
    // Use this after we select a treatment to compute the new payoffs for all treatments
    // given that this treatment has been selected.

    // no knockdowns
    if (knockdownType === "none") {
      return currentPayoffs;
    }

    // single value for knockdown_factors
    // only knock down the payoff for the treatment used
    if (knockdownType === "single") {
      return currentPayoffs.map((p, i) => (i === index ? p * knockdowns : p));
    }

    // array of values for knockdown_factors of length n
    // only knock down the payoff for the treatment used
    if (knockdownType === "array") {
      return currentPayoffs.map((p, i) =>
        i === index ? p * knockdowns[index] : p
      );
    }

    // matrix of values for knockdown_factors of size n x n
    // knock down the payoff for all treatments when a particular treatment is used
    if (knockdownType === "matrix") {
      return currentPayoffs.map((p, i) => p * knockdowns[index][i]);
    }

    throw new Error("Invalid knockdown type");
  }

  function dispatch(availablePlayers) {
    // Dispatch participants to treatments
    //
    // Arguments:
    // - availablePlayers: a list of player objects, each containing a playerId and other properties.
    //   Only players who have not been assigned to a treatment are included.
    //
    // Returns an `assignments` list with the following properties:
    // - each entry is an oject representing a game to create, and containing properties:
    //   - treatment: the treatment object for the game
    //   - list of `slotAssignments`, each representing the assignemnt of a participant to a position in the game, containing properties:
    //     - playerId: the playerId of the participant
    //     - position: the position in the game
    //
    // "dispatch" is essentially a depth-first search, where the search tree is assignments of participants to treatment positions
    // We use a recursive function to explore the tree, and we keep track of the best solution found so far at the top level.
    //
    // We use a number of heuristics to prune the search tree and to stop the search early:
    // - We sort the treatments by cost and assign participants to the cheapest treatments first
    // - When we assign a participant to a new treatment, we attempt to fill the remaining slots in the treatment with other participants
    //   before moving on to another treatment. If we can't fill the treatment, we abandon the branch.
    // - We set a maximum number of iterations, and we stop the search if we exceed this number, returning the best solution found so far.
    // - Stop if we are within a certain fraction of the minimum possible cost, and we have explored the search space for a minimum number of iterations.
    //

    const nPlayersAvailable = availablePlayers.length;
    // randomize the order in which we assign participants to remove bias due to arrival time
    const playerIds = shuffle(availablePlayers.map((p) => p.id));

    // check that playerIds are unique
    if (new Set(playerIds).size !== playerIds.length) {
      throw new Error("Duplicate playerIds in availablePlayers", playerIds);
      // todo: should we just log this error, or should we actively fix it?
    }

    const maxPayoff = getTheoreticalMaxPayoff(
      treatments,
      persistentPayoffs,
      knockdowns,
      nPlayersAvailable
    );

    const stoppingThreshold = maxPayoff * requiredFractionOfMaximumPayoff;

    info(`Dispatch with ${nPlayersAvailable} players`);

    let iterCount = 0;
    let stop = false;
    let currentBestPayoff = 0;
    let currentBestAssignment = [];
    let currentBestUpdatedPayoffs = persistentPayoffs;

    function recurse({
      unassignedPlayerIds, // list of player ids for players who have not been assigned to a treatment
      committedSlots, // list of tuples of treatment index and position e.g. [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]]
      payoffs, // list of payoffs for each treatment given the current state of the search
      partialSolution, // list of tuples of participant index, treatment index, and position e.g. [[0, 0, 0], [2, 0, 1], [3, 1, 0], [5, 1, 1], [8, 2, 0], [9, 2, 1]]
      partialSolutionPayoff, // payoff of the partial solution e.g. 10
      currentGroupIndex = 0,
    }) {
      // --------------------------------------------------------------
      // ** Pruning **
      // --------------------------------------------------------------

      // if this branch can never lead to a solution, abandon it
      if (committedSlots.length > unassignedPlayerIds.length) return;

      // if this branch can never lead to a better solution than the current best, abandon it
      // if (partialSolutionPayoff >= currentBestCost) return;
      if (
        partialSolutionPayoff +
          Math.max(...payoffs) * unassignedPlayerIds.length <
        currentBestPayoff
      )
        return; // not quite as clean as with the cost formulation

      // We have found a solution.
      if (unassignedPlayerIds.length === 0) {
        // See if it's better than the current best.
        if (partialSolutionPayoff > currentBestPayoff) {
          currentBestPayoff = partialSolutionPayoff;
          currentBestAssignment = partialSolution;
          currentBestUpdatedPayoffs = payoffs;
        }

        // Is the current best solution good enough to stop searching?
        if (
          currentBestPayoff === maxPayoff || // we cannot do better than the maximum possible payoff, so quit regardless of the number of iterations
          (currentBestPayoff > stoppingThreshold && iterCount >= minIter) // we have found an adequate solution after at least minimum exploration
        ) {
          stop = true;
        }
        return;
      }

      // if we have exceeded the maximum number of iterations, quit no matter what
      iterCount += 1;
      if (iterCount > maxIter) {
        stop = true;
        return;
      }

      // --------------------------------------------------------------
      // ** Subproblem for when we have committed slots **
      // In this case, our priority is to fill the committed slots
      // with any participant that is eligible for the slot.
      // For simplicity, we do this in the order they appear in the list.
      // --------------------------------------------------------------
      if (committedSlots.length > 0) {
        const [treatmentIndex, position] = committedSlots[0];

        for (const playerId of unassignedPlayerIds) {
          if (
            isEligible(availablePlayers, playerId, treatmentIndex, position)
          ) {
            recurse({
              unassignedPlayerIds: unassignedPlayerIds.filter(
                (i) => i !== playerId
              ),
              committedSlots: committedSlots.slice(1),
              payoffs, // no change to payoffs when we fill in already committed slots. We only knock down payoffs when we commit to a new treatment.
              partialSolution: [
                ...partialSolution,
                [playerId, currentGroupIndex, treatmentIndex, position],
              ],
              partialSolutionPayoff, // account for committed slot costs when we make the commitment (below).
              currentGroupIndex,
            });
          }

          if (stop) return;
        }
        return; // if we can't fill the committed slot, we can't proceed with this branch
      }

      // --------------------------------------------------------------
      // ** Subproblem for when we do not have committed slots  **
      // In this case, our priority is to assign all participants to
      // the cheapest treatments.
      // --------------------------------------------------------------

      // store the longest valid partial solution in case we don't ever complete a full solution,
      // we still have something to return if we exceed maxIter
      if (partialSolution.length > currentBestAssignment.length) {
        currentBestAssignment = partialSolution;
      }

      // work with the first unassigned participant. If we can't assign them here, we'll never be able to.
      const playerId = unassignedPlayerIds[0];

      // sort treatments by highest payoff, adding a random decimal to break ties, and return the treatment indices
      // Todo: in most cases, we will only need the maximum payoff treatment, not the whole list.
      // We could probably optimize this by finding and popping the maximum payoff treatment in the loop below.
      const sortedTreatmentIndices = payoffs
        .map((cost, index) => [cost + Math.random() / 10000, index])
        .sort((a, b) => b[0] - a[0])
        .map((pair) => pair[1]);

      for (const treatmentIndex of sortedTreatmentIndices) {
        const positions = Array.from(
          { length: treatments[treatmentIndex].playerCount },
          (_, i) => i
        );
        for (const position of positions) {
          if (
            isEligible(availablePlayers, playerId, treatmentIndex, position)
          ) {
            const newPayoffs = knockdown(payoffs, treatmentIndex);

            recurse({
              unassignedPlayerIds: unassignedPlayerIds.slice(1),
              committedSlots: positions
                .filter((p) => p !== position)
                .map((p) => [treatmentIndex, p]),
              payoffs: newPayoffs,
              partialSolution: [
                ...partialSolution,
                [playerId, currentGroupIndex, treatmentIndex, position],
              ],
              partialSolutionPayoff:
                partialSolutionPayoff +
                payoffs[treatmentIndex] * positions.length,
              currentGroupIndex: currentGroupIndex + 1,
            });
          }

          if (stop) return;
        }
      }

      // --------------------------------------------------------------
      // ** Subproblem for when current participant can't be assigned to any treatment **
      // This could happen either because they are not eligible for any treatment,
      // because we can't find other people to make up a full treatment with them,
      // or because all treatments are full.
      //
      // In this case, we return them to the lobby and pay the noAssignCost.
      // --------------------------------------------------------------

      recurse({
        unassignedPlayerIds: unassignedPlayerIds.slice(1),
        committedSlots: [],
        payoffs,
        partialSolution: [...partialSolution, [playerId, null, null, null]], // no assignment
        partialSolutionPayoff: partialSolutionPayoff + 0, // no reward for not assigning
        currentGroupIndex,
      });
    }

    // --------------------------------------------------------------
    // Root call to search tree
    // --------------------------------------------------------------
    recurse({
      unassignedPlayerIds: playerIds,
      committedSlots: [],
      payoffs: persistentPayoffs,
      partialSolution: [],
      partialSolutionPayoff: 0,
      currentGroupIndex: 0,
    });

    // ---------------------------------------------------------------
    // Validate and format the result
    // ---------------------------------------------------------------

    // check that all players are either assigned to a game or are explicitly given null assignments
    const handledPlayerIds = currentBestAssignment.map((p) => p[0]);
    const playerIdsSet = new Set(playerIds);
    const handledPlayerIdsSet = new Set(playerIds);

    const unhandledPlayerIds = playerIdsSet.difference(handledPlayerIdsSet);
    if (unhandledPlayerIds.size > 0) {
      warn("Unhandled players:", unhandledPlayerIds);
    }

    const unrecognizedPlayerIds = handledPlayerIdsSet.difference(playerIdsSet);
    if (unrecognizedPlayerIds.size > 0) {
      warn("Unrecognized players:", unrecognizedPlayerIds);
    }

    if (handledPlayerIds.length > nPlayersAvailable) {
      warn(
        "Some players were assigned more than once:",
        playerIds,
        handledPlayerIds
      );
    }

    // build out the assignments object
    const assignments = [];
    for (const playerAssignment of currentBestAssignment) {
      const [playerId, groupIndex, treatmentIndex, position] = playerAssignment;

      if (groupIndex === null) {
        warn("Unassigned player:", playerId);
        continue;
      }

      if (assignments[groupIndex] === undefined) {
        assignments[groupIndex] = {
          treatment: treatments[treatmentIndex],
          slotAssignments: [],
        };
      }

      assignments[groupIndex].slotAssignments.push({
        playerId,
        position,
      });
    }

    // check that all slots are assigned and that there are the right number of players in each game
    for (const assignment of assignments) {
      // check that all slots are assigned
      const assignedPositions = assignment.slotAssignments.map(
        (a) => a.position
      );
      const expectedPositions = Array.from(
        { length: assignment.treatment.playerCount },
        (_, i) => i
      );
      if (new Set(assignedPositions) !== new Set(expectedPositions)) {
        error(
          "Position assignment issue, expected positions ",
          expectedPositions,
          " but got ",
          assignedPositions
        );
      }

      // check that there are the right number of players in each game
      if (assignment.players.length !== assignment.treatment.playerCount) {
        error(
          "Wrong number of players, expected ",
          assignment.treatment.playerCount,
          " but got ",
          assignment.players.length
        );
      }
    }

    // update the payoffs for the next dispatch
    persistentPayoffs = currentBestUpdatedPayoffs;

    return assignments;
  }

  return dispatch;
}
