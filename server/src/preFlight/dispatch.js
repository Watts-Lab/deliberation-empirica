/* eslint-disable no-restricted-syntax */

import { compare } from "../utils/comparison";

function shuffle(arr) {
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
  function dispatch(availableParticipants) {
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
  }

  const nParticipants = availableParticipants.length;
  let iterCount = 0;
  const maxCost = nParticipants * noAssignCost;
  const minCost = getMinCost(treatments, nParticipants, noAssignCost);
  let currentBestCost = maxCost;
  let currentBestAssignment = null;
  const stoppingThreshold =
    minCost + (maxCost - minCost) * (1 - requiredFractionOfMaximumImprovement);
}
