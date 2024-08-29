/* eslint-disable no-restricted-syntax */
export function shuffle(arr) {
  // randomize the order of an array, returning a new array
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled;
}

export function unique(arr) {
  // return a new array with only unique elements
  return [...new Set(arr)];
}

export function leftovers(target, factors) {
  // Given an integer `target` and a list of integers `factors`,
  // returns the smallest number needed to add to an arbitrary number of factors
  // to sum to `target`.
  // We use this to figure out how many participants we will not be able to assign
  // to games of sizes in `factors`, even if we have optimum and unconstrained assignment.
  if (target === 0) return 0;

  const uniqueFactors = unique(factors)
    .filter((f) => f <= target) // remove factors that are too large
    .sort((a, b) => b - a); // sort descending

  if (uniqueFactors.length === 0) return target;

  let closest = target;
  for (const factor of uniqueFactors) {
    const modulo = target % factor;
    if (modulo === 0) return 0;
    if (uniqueFactors.includes(modulo)) return 0;

    const leftover = leftovers(target - factor, factors);
    if (leftover === 0) return 0;

    if (leftover < closest) {
      closest = leftover;
    }
  }

  return closest;
}
