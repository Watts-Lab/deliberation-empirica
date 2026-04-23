/**
 * Shared batch-config summarization helpers.
 *
 * Used by both the science-data export (`postFlight/scienceDataHelpers`) and
 * the pre-registration export (`preFlight/preregisterHelpers`) so both writes
 * record the same condensed config shape. Lives in `utils/` to break the
 * `preFlight → postFlight` cross-directory dependency the previous layout
 * had.
 */

// Compute summary statistics for a knockdowns value (number, 1D or 2D array)
// so the exported config stays compact. Returns null when the input can't be
// interpreted as numbers — callers decide what to do with that.
export function computeKnockdownDetails(input) {
  let shape;
  let flatArray;
  if (typeof input === "number") {
    shape = [1];
    flatArray = [input];
  } else if (Array.isArray(input) && Array.isArray(input[0])) {
    shape = [input.length, input[0].length];
    flatArray = input.flat(Infinity);
  } else if (Array.isArray(input)) {
    shape = [input.length];
    flatArray = input.flat(Infinity);
  } else {
    return null;
  }
  const sum = flatArray.reduce((acc, val) => acc + val, 0);
  const std = Math.sqrt(
    flatArray.reduce((acc, val) => acc + (val - sum) ** 2, 0) /
      flatArray.length,
  );
  const max = Math.max(...flatArray);
  const min = Math.min(...flatArray);
  return { shape, sum, std, max, min };
}

// Produce a copy of the batch's validated config with the knockdown matrix
// replaced by summary stats. Matches the shape the science-data + pre-reg
// exports have shipped since before the stagebook migration.
export function condenseBatchConfig(batchConfig) {
  if (!batchConfig) return "missing";
  const condensed = JSON.parse(JSON.stringify(batchConfig));
  if (condensed.knockdowns !== "none") {
    const details = computeKnockdownDetails(condensed.knockdowns);
    if (details) {
      condensed.knockdownDetails = details;
      condensed.knockdowns = undefined;
    }
  }
  return condensed;
}
