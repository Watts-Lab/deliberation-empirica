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
import {
  batchConfigSchema,
  validateBatchConfig,
  ValidationError,
} from "./validateBatchConfig.ts";

const passingConfig = {
  batchName: "test-batch",
  cdn: "test",
  treatmentFile: "projects/example/cypress.treatments.yaml",
  introSequence: "cypress_intro",
  treatments: ["cypress_omnibus", "cypress1_simple"],
  payoffs: [1, 0.8],
  knockdowns: [
    [0.5, 1],
    [1, 0.1],
  ],
  exitCodes: {
    complete: "complete_code",
    error: "error_code",
    lobbyTimeout: "lobby_timeout_code",
  },
  platformConsent: "US",
  consentAddendum: "none",
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
  centralPrereg: false,
  checkVideo: true,
  checkAudio: true,
};

// test("valid configuration passes", () => {
//   const config = JSON.parse(JSON.stringify(passingConfig));
//   const result = batchConfigSchema.safeParse(config);
//   if (!result.success) console.log(result.error.format());
//   expect(result.success).toBe(true);
// });

test("valid configuration passes", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  expect(() => validateBatchConfig(config)).not.to.throw(ValidationError);
});

test("all values are missing", () => {
  const config = {};
  // validateBatchConfig(config);
  expect(() => validateBatchConfig(config)).to.throw(ValidationError);
});

test("payoffs have different length than treatments", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  config.payoffs = [1];
  expect(() => validateBatchConfig(config)).to.throw(
    ValidationError,
    /Number of payoffs must match/
  );
});

test("knockdown matrix is the wrong shape", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  config.knockdowns = [
    [0.5, 1],
    [1, 0.1, 0.5],
    [0.5, 1],
  ];
  expect(() => validateBatchConfig(config)).to.throw(
    ValidationError,
    /Knockdown matrix/
  );
});

test.skip("preregRepo missing values", () => {
  // need to give a better error message
  const config = JSON.parse(JSON.stringify(passingConfig));
  config.preregRepos[0].owner = undefined;
  const result = batchConfigSchema.safeParse(config);
  if (!result.success) console.log(result.error.format());
  expect(result.success).toBe(false);
  expect(() => validateBatchConfig(config)).to.throw(ValidationError);
});

test("always check audio if checking video", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  config.checkVideo = true;
  config.checkAudio = false;
  expect(() => validateBatchConfig(config)).to.throw(
    ValidationError,
    /Cannot check video without also checking audio/
  );
});

test("no unrecognized keys", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  config.unrecognizedKey = "unrecognized value";
  // validateBatchConfig(config);
  expect(() => validateBatchConfig(config)).to.throw(
    ValidationError,
    /Unrecognized/
  );
});

test("immediate launchDate", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  config.launchDate = "immediate";
  expect(() => validateBatchConfig(config)).not.to.throw(ValidationError);
});

test("videoStorage region is missing", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  delete config.videoStorage.region;
  const result = batchConfigSchema.safeParse(config);
  // if (!result.success) console.log(result.error);
  expect(result.success).toBe(false);
});

test("videoStorage region is missing", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  delete config.videoStorage.region;
  const result = batchConfigSchema.safeParse(config);
  // if (!result.success) console.log(result.error);
  expect(result.success).toBe(false);
});

test.skip("videoStorage bucket does not exist", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  config.videoStorage.bucket = "nonexistent-test-bucket";
  const result = batchConfigSchema.safeParse(config);
  expect(result.success).toBe(false);
  // Todo: add check for error message
});

test.skip("videoStorage region is incorrect for bucket", () => {
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

test.skip("prereg repos don't exist", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  config.preregRepos[0].owner = "nonexistent-owner";
  const result = batchConfigSchema.safeParse(config);
  expect(result.success).toBe(false);
  // Todo: add check for error message
});

test.skip("datarepos don't exist", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  config.dataRepos[0].owner = "nonexistent-owner";
  const result = batchConfigSchema.safeParse(config);
  expect(result.success).toBe(false);
  // Todo: add check for error message
});

test.skip("treatment File doesn't exist", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  config.treatmentFile = "nonexistent-file.yaml";
  const result = batchConfigSchema.safeParse(config);
  expect(result.success).toBe(false);
  // Todo: add check for error message
});

test.skip("treatment File is invalid", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  config.treatmentFile = "projects/example/invalid.treatments.yaml";
  const result = batchConfigSchema.safeParse(config);
  expect(result.success).toBe(false);
  // Todo: add check for error message
});

test.skip("intro sequence is not present in treatment file", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  config.introSequence = "nonexistent-sequence";
  const result = batchConfigSchema.safeParse(config);
  expect(result.success).toBe(false);
  // Todo: add check for error message
});

test.skip("treatment name is not present in treatment file", () => {
  const config = JSON.parse(JSON.stringify(passingConfig));
  config.treatments = ["nonexistent-treatment"];
  const result = batchConfigSchema.safeParse(config);
  expect(result.success).toBe(false);
  // Todo: add check for error message
});
