/* eslint-disable no-restricted-syntax */
export function shuffle(arr) {
  // randomize the order of an array, returning a new array
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled;
}

export function leftovers(target, factors) {
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
