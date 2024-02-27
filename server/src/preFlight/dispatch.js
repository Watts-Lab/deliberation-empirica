/* eslint-disable no-restricted-syntax */
import { info } from "@empirica/core/console";
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

export function makeDispatcher({
  treatments,
  noAssignCost = 50,
  requiredFractionOfMaximumImprovement = 0.9,
  maxIter = 3000,
  minIter = 100,
}) {
  // Each batch has a single dispatch function that runs multiple times to assign participants to treatments as they arrive
  // we use a closure pattern so that we can persist some state between calls

  // todo:
  // - persist the isEligibleCache. This will require rewriting the arguments to accept the participant ID instead of index.
  // - persist the treatmentCosts for the best solution found so far, so that we can use it as a starting point for the next call.
  //   either that or persist  the count of the number of times each treatment has been used, so that we can calculate the cost of a new solution without having to re-run the whole thing.
  // - take the treatment costs as an argument

  function dispatch(availableParticipants) {
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

    const isEligibleCache = new Map();
    function isEligible(participantIndex, treatmentIndex, position) {
      const cacheKey = `${participantIndex}-${treatmentIndex}-${position}`;
      if (isEligibleCache.has(cacheKey)) {
        return isEligibleCache.get(cacheKey);
      }

      const treatment = treatments[treatmentIndex];
      const candidate = availableParticipants[participantIndex];
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

    const nParticipants = availableParticipants.length;

    const startingTreatmentCosts = treatments.map(
      (treatment) => treatment.cost
    ); // e.g [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]
    const maxCost = nParticipants * noAssignCost;
    const minCost = getMinCost(treatments, nParticipants, noAssignCost);
    const stoppingThreshold =
      minCost +
      (maxCost - minCost) * (1 - requiredFractionOfMaximumImprovement);

    // randomize the order in which we assign participants to remove bias due to arrival time
    const participantIndices = shuffle(
      Array.from({ length: nParticipants }, (_, i) => i + 1)
    );

    info(`Dispatch with min 'cost' ${minCost}, max 'cost' ${maxCost}`);

    let iterCount = 0;
    let stop = false;
    let currentBestCost = maxCost;
    let currentBestAssignment = [];

    function recurse({
      availableParticipantIndices, // list of indices of unassigned participants e.g. [0, 2, 3, 5, 8, 9]
      committedSlots, // list of tuples of treatment index and position e.g. [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]]
      treatmentCosts, // list of costs for each treatment e.g. [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]. When a treatment is used, we increase the cost of the treatment by 1 for the next use.
      partialSolution, // list of tuples of participant index, treatment index, and position e.g. [[0, 0, 0], [2, 0, 1], [3, 1, 0], [5, 1, 1], [8, 2, 0], [9, 2, 1]]
      partialSolutionCost, // numeric cost of the partial solution e.g. 10
    }) {
      // if this branch can never lead to a solution, abandon it
      if (committedSlots.length > availableParticipantIndices.length) return;

      // if this branch can never lead to a better solution than the current best, abandon it
      if (partialSolutionCost >= currentBestCost) return;

      // We have found a solution.
      if (availableParticipantIndices.length === 0) {
        // See if it's better than the current best.
        if (partialSolutionCost < currentBestCost) {
          currentBestCost = partialSolutionCost;
          currentBestAssignment = partialSolution;
        }

        // Is the current best solution good enough to stop searching?
        if (
          currentBestCost === minCost || // we cannot do better than the minimum cost
          (currentBestCost < stoppingThreshold && iterCount >= minIter) // we have found an adequate solution after at least minimum exploration
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

        for (const participantIndex of availableParticipantIndices) {
          if (isEligible(participantIndex, treatmentIndex, position)) {
            recurse({
              availableParticipantIndices: availableParticipantIndices.filter(
                (i) => i !== participantIndex
              ),
              committedSlots: committedSlots.slice(1),
              treatmentCosts, // no change to treatmentCosts when we fill in already committed slots. We only change treatmentCosts when we commit to a new treatment.
              partialSolution: [
                ...partialSolution,
                [participantIndex, treatmentIndex, position],
              ],
              partialSolutionCost, // account for committed slot costs when we make the commitment (below).
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
      if (partialSolutionCost.length > currentBestAssignment.length) {
        currentBestAssignment = partialSolution;
      }

      // work with the first unassigned participant. If we can't assign them here, we'll never be able to.
      const participantIndex = availableParticipantIndices[0];

      // sort treatments by lowest cost, adding a random decimal to break ties, and return the treatment indices
      const sortedTreatmentIndices = treatmentCosts
        .map((cost, index) => [cost + Math.random() / 1000, index])
        .sort((a, b) => a[0] - b[0])
        .map((pair) => pair[1]);

      for (const treatmentIndex of sortedTreatmentIndices) {
        const positions = Array.from(
          { length: treatments[treatmentIndex].playerCount },
          (_, i) => i
        );
        for (const position of positions) {
          if (isEligible(participantIndex, treatmentIndex, position)) {
            const newTreatmentCosts = [...treatmentCosts];
            newTreatmentCosts[treatmentIndex] += 1; // increase the cost of the treatment by 1 for the next use, to encourage diversity in treatment assignment

            recurse({
              availableParticipantIndices: availableParticipantIndices.slice(1),
              committedSlots: positions
                .filter((p) => p !== position)
                .map((p) => [treatmentIndex, p]),
              treatmentCosts: newTreatmentCosts,
              partialSolution: [
                ...partialSolution,
                [participantIndex, treatmentIndex, position],
              ],
              partialSolutionCost:
                partialSolutionCost +
                newTreatmentCosts[treatmentIndex] * positions.length,
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

      if (noAssignCost + partialSolutionCost < currentBestCost) {
        recurse({
          availableParticipantIndices: availableParticipantIndices.slice(1),
          committedSlots: [],
          treatmentCosts,
          partialSolution: [...partialSolution, [participantIndex, null, null]],
          partialSolutionCost: partialSolutionCost + noAssignCost,
        });
      }

      // if we get here, we couldn't find a solution for this branch that was better than the current best
      // so we abandon it.
    }

    recurse({
      availableParticipantIndices: participantIndices,
      committedSlots: [],
      treatmentCosts: startingTreatmentCosts,
      partialSolution: [],
      partialSolutionCost: 0,
    });

    // check that everything came out correctly
    // check that every participant has been assigned, and that no participant has been assigned twice
    // check that all games are full

    return {
      assignment: currentBestAssignment,
      cost: currentBestCost,
      iterations: iterCount,
    };
  }
  return dispatch;
}
