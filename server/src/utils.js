/* eslint-disable no-restricted-syntax */
// import * as fs from "fs";
import axios from "axios";

export function getFileURL(file) {
  const rawURL = `https://deliberation-assets.nyc3.cdn.digitaloceanspaces.com/${file}`;
  return encodeURI(rawURL);
}

export async function getText({ cdn, path }) {
  const cdnList = {
    test: "http://localhost:9091",
    local: "http://localhost:9090",
    prod: "https://deliberation-assets.nyc3.cdn.digitaloceanspaces.com",
  };

  const cdnURL = cdnList[cdn] || cdn || cdnList.prod;
  const fileURL = encodeURI(`${cdnURL}/${path}`);
  console.log(`Getting file from url: ${fileURL}`);

  const { data, status } = await axios.get(fileURL);
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
  // players can join an open batch
  const openBatches = [];

  for (const [, batch] of batches) {
    // console.log(
    //   `Batch ${batch.id} is ${batch.get(
    //     "status"
    //   )} and afterLastEntry = ${batch.get("afterLastEntry")}`
    // );
    if (batch.get("status") === "running" && !batch.get("afterLastEntry"))
      openBatches.push(batch);
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
      console.log(
        `Failed to parse createdAt timestamp for Batch ${comparisonBatch.id}`
      );
      console.log(err);
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
