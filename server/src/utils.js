/* eslint-disable no-restricted-syntax */
// import * as fs from "fs";
// Todo: move these to the utils folder
import { error } from "@empirica/core/console";

export function toArray(maybeArray) {
  // different from Array.from() in that it won't break apart strings
  if (maybeArray instanceof Array) return maybeArray;
  return [maybeArray];
}

export function getOpenBatches(ctx) {
  // Return an array of open batches
  const batches = ctx.scopesByKind("batch"); // returns Map object
  const openBatches = [];
  for (const [, batch] of batches) {
    if (batch.get("status") === "running") openBatches.push(batch);
  }
  return openBatches;
}

export function selectOldestBatch(batches) {
  if (!Array.isArray(batches)) return undefined;
  if (!batches.length > 0) return undefined;

  let currentOldestBatch = batches[0];
  for (const comparisonBatch of batches) {
    try {
      if (
        Date.parse(currentOldestBatch.get("createdAt")) >
        Date.parse(comparisonBatch.get("createdAt"))
      )
        currentOldestBatch = comparisonBatch;
    } catch (err) {
      error(
        `Failed to parse createdAt timestamp for Batch ${comparisonBatch.id}`,
        err
      );
    }
  }

  return currentOldestBatch;
}

export function isArrayOfStrings(variable) {
  return (
    Array.isArray(variable) &&
    variable.every(
      (entry) => typeof entry === "string" || entry instanceof String
    )
  );
}
