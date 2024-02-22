/* eslint-disable default-case */

const trimSlashes = (str) =>
  str
    .split("/")
    .filter((v) => v !== "")
    .join("/");

export function compare(lhs, comparator, rhs) {
  // uses chai assertion style

  switch (comparator) {
    case "exists":
      return lhs !== undefined;
    case "notExists":
    case "doesNotExist":
      return lhs === undefined;
    case "equal":
    case "equals":
      return lhs === rhs;
    case "notEqual":
    case "doesNotEqual":
      return lhs !== rhs;
  }

  if (lhs === undefined) {
    // sometimes the LHS is undefined, such as when the player has not typed
    // anything into a text entry field. In this case, we should return a falsy value
    // returning undefined signals that it isn't just that the comparison
    // returned a falsy value, but that the comparison could not yet be made
    return undefined;
  }

  if (!Number.isNaN(lhs) && !Number.isNaN(rhs)) {
    // check that lhs is a number
    // (types can go crazy here, as this works for strings containing numbers, like lhs="5")
    const numLhs = parseFloat(lhs);
    const numRhs = parseFloat(rhs);
    switch (comparator) {
      case "isAbove":
        return numLhs > numRhs;
      case "isBelow":
        return numLhs < numRhs;
      case "isAtLeast":
        return numLhs >= numRhs;
      case "isAtMost":
        return numLhs <= numRhs;
    }
  }

  if (typeof lhs === "string" && !Number.isNaN(rhs)) {
    switch (comparator) {
      case "lengthAtLeast":
      case "hasLengthAtLeast":
        return lhs.length >= parseFloat(rhs);
      case "lengthAtMost":
      case "hasLengthAtMost":
        return lhs.length <= parseFloat(rhs);
    }
  }

  if (typeof lhs === "string" && typeof rhs === "string") {
    switch (comparator) {
      case "include":
      case "includes":
        return lhs.includes(rhs);
      case "notInclude":
      case "doesNotInclude":
        return !lhs.includes(rhs);
      case "match":
      case "matches":
        return !!lhs.match(new RegExp(trimSlashes(rhs)));
      case "notMatch":
      case "doesNotMatch":
        return !lhs.match(new RegExp(trimSlashes(rhs)));
    }
  }

  if (Array.isArray(rhs)) {
    switch (comparator) {
      case "oneOf":
      case "isOneOf":
        return Array.isArray(rhs) && rhs.includes(lhs); // check that rhs is an array
      case "notOneOf":
      case "isNotOneOf":
        return Array.isArray(rhs) && !rhs.includes(lhs); // check that rhs is an array
    }
  }

  console.error(
    `Invalid comparator: ${comparator} for lhs: ${lhs} and rhs: ${rhs}`
  );

  return undefined;
}
