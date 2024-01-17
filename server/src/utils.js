/* eslint-disable no-restricted-syntax */
// import * as fs from "fs";
import axios from "axios";
import { error, debug } from "@empirica/core/console";

// export function getFileURL(file) {
//   const rawURL = `https://s3.amazonaws.com/assets.deliberation-lab.org/${file}`;
//   return encodeURI(rawURL);
// }

export async function getText({ cdn, path }) {
  const cdnList = {
    test: "http://localhost:9091",
    local: "http://localhost:9090",
    prod: "https://s3.amazonaws.com/assets.deliberation-lab.org",
  };

  const cdnURL = cdnList[cdn] || cdn || cdnList.prod;
  const fileURL = encodeURI(`${cdnURL}/${path}`);
  debug(`Getting file from url: ${fileURL}`);

  const { data, status } = await axios
    .get(fileURL, {
      // query URL without using browser cache
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        Expires: "0",
      },
    })
    .catch((err) => {
      error(`Failed to fetch file from ${fileURL}`, err);
      throw err;
    });

  if (status !== 200) {
    throw new Error(
      `Could not fetch file from ${cdnURL} corresponding to file path ${path}`
    );
  }

  return data;
}

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
