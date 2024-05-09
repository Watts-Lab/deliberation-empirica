/*
Use vitest to test the function validateBatchConfig
includes the following test cases:

Validation succeeds:
1. valid configuration passes

Validation fails:
2. videoStorage bucket does not exist (e.g. "nonexistent-test-bucket")
3. videoStorage region is incorrect for bucket (e.g. "us-west-1" for bucket "deliberation-lab-recordings-test")
4. launchDate is in the past
5. launchDate is invalid
6. prereg repos don't exist
7. datarepos don't exist
8. treatment File doesn't exist
9. treatment File is invalid
10. intro sequence is not present in treatment file
12. treatment name is not present in treatment file

*/

import { expect, test } from "vitest";
import { batchConfigSchema } from "./validateBatchConfig.ts";

const passingConfig = {
  batchName: "test-batch",
  cdn: "test",
  treatmentFile: "projects/example/cypress.treatments.yaml",
  introSequence: "cypress_intro",
  treatments: ["cypress_omnibus"],
  exitCodes: {
    complete: "complete_code",
    error: "error_code",
    lobbyTimeout: "lobby_timeout_code",
  },
  launchDate: new Date(Date.now() + 25 * 1000).toUTCString(),
  dispatchWait: 5,
  videoStorage: {
    bucket: "deliberation-lab-recordings-test",
    region: "us-east-1",
  },
  preregRepos: [
    {
      owner: "Watts-Lab",
      repo: "deliberation-data-test",
      branch: "main",
      directory: "preregistration",
    },
  ],
  dataRepos: [
    {
      owner: "Watts-Lab",
      repo: "deliberation-data-test",
      branch: "main",
      directory: "cypress_test_exports",
    },
    {
      owner: "Watts-Lab",
      repo: "deliberation-data-test",
      branch: "main",
      directory: "cypress_test_exports2",
    },
  ],
  preregister: false,
  checkVideo: true,
  checkAudio: true,
};

test("valid configuration passes", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  const result = batchConfigSchema.safeParse(config);
  if (!result.success) console.log(result.error);
  expect(result.success).toBe(true);
});

test("videoStorage bucket does not exist", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  config.videoStorage.bucket = "nonexistent-test-bucket";
  const result = batchConfigSchema.safeParse(config);
  expect(result.success).toBe(false);
  // Todo: add check for error message
});

test("videoStorage region is incorrect for bucket", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  config.videoStorage.region = "us-west-1";
  const result = batchConfigSchema.safeParse(config);
  expect(result.success).toBe(false);
  // Todo: add check for error message
});

test("launchDate is in the past", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  config.launchDate = new Date(Date.now() - 25 * 1000).toUTCString();
  const result = batchConfigSchema.safeParse(config);
  expect(result.success).toBe(false);
  // Todo: add check for error message
});

test("launchDate is invalid", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  config.launchDate = "invalid-date";
  const result = batchConfigSchema.safeParse(config);
  expect(result.success).toBe(false);
  // Todo: add check for error message
});

test("prereg repos don't exist", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  config.preregRepos[0].owner = "nonexistent-owner";
  const result = batchConfigSchema.safeParse(config);
  expect(result.success).toBe(false);
  // Todo: add check for error message
});

test("datarepos don't exist", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  config.dataRepos[0].owner = "nonexistent-owner";
  const result = batchConfigSchema.safeParse(config);
  expect(result.success).toBe(false);
  // Todo: add check for error message
});

test("treatment File doesn't exist", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  config.treatmentFile = "nonexistent-file.yaml";
  const result = batchConfigSchema.safeParse(config);
  expect(result.success).toBe(false);
  // Todo: add check for error message
});

test("treatment File is invalid", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  config.treatmentFile = "projects/example/invalid.treatments.yaml";
  const result = batchConfigSchema.safeParse(config);
  expect(result.success).toBe(false);
  // Todo: add check for error message
});

test("intro sequence is not present in treatment file", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  config.introSequence = "nonexistent-sequence";
  const result = batchConfigSchema.safeParse(config);
  expect(result.success).toBe(false);
  // Todo: add check for error message
});

test("treatment name is not present in treatment file", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  config.treatments = ["nonexistent-treatment"];
  const result = batchConfigSchema.safeParse(config);
  expect(result.success).toBe(false);
  // Todo: add check for error message
});
