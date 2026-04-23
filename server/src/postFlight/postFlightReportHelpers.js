/**
 * Pure statistical helpers used by postFlightReport.
 *
 * Extracted so numerical aggregations (timings summaries, QC percentages,
 * categorical counts) can be unit-tested without mocking the filesystem
 * or GitHub client. The orchestrator in postFlightReport.js imports
 * these and wires them up.
 */

// Count how many times each value appears in an array.
// Returns an object: { <stringified value>: count, ... }
export function valueCounts(arr) {
  return arr.reduce((acc, cur) => {
    if (acc[cur] === undefined) {
      acc[cur] = 1;
    } else {
      acc[cur] += 1;
    }
    return acc;
  }, {});
}

// Fraction of total for each value.
export function valuePercentages(arr) {
  const counts = valueCounts(arr);
  const total = arr.length;
  return Object.fromEntries(
    Object.entries(counts).map(([key, value]) => [key, value / total])
  );
}

// Summarize a numeric array as { max, min, mean, median }.
// Treats non-finite entries as absent. Returns sentinel values when the
// array is empty so downstream consumers see "missing" rather than NaN or
// Infinity:
//   { max: null, min: null, mean: null, median: null }
//
// Correctness note: uses a numeric comparator for sorting (the previous
// inline implementations in postFlightReport.js used default `.sort()`,
// which sorts lexically — giving the wrong median for arrays like
// [1, 2, 10] where "10" < "2" as strings).
export function summarizeNumericArray(arr) {
  const numeric = (arr || []).filter((v) => Number.isFinite(v));
  if (numeric.length === 0) {
    return { max: null, min: null, mean: null, median: null };
  }
  const sorted = [...numeric].sort((a, b) => a - b);
  const mean = sorted.reduce((acc, cur) => acc + cur, 0) / sorted.length;
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
  return {
    max: sorted[sorted.length - 1],
    min: sorted[0],
    mean,
    median,
  };
}

// Sum a field across sub-summaries. Used to compose "totalTime" and
// "totalActiveTime" from the per-phase summaries in postFlightReport.
// Treats null (the empty-input sentinel from summarizeNumericArray) as 0
// so a missing phase doesn't poison the aggregate.
export function sumFieldAcross(summaries, field) {
  return summaries.reduce((acc, s) => acc + (s?.[field] ?? 0), 0);
}

// Filter out common "none" / "nothing" / "no" / empty answers from a
// free-text QC column. Matches the behavior of the original inline code
// — useful for keeping text-expansion / technical-detail comments that
// are actually meaningful.
const BLANK_FREE_TEXT = new Set(["no", "nan", "none", "nothing"]);

export function filterFreeTextResponses(arr) {
  return (arr || []).filter((text) => {
    if (text == null) return false;
    const normalized = String(text).toLowerCase().trim();
    if (normalized === "") return false;
    return !BLANK_FREE_TEXT.has(normalized);
  });
}
