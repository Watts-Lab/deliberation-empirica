import { expect, test } from "vitest";
import {
  referenceSchema,
  conditionSchema,
  introConditionSchema,
  elementSchema,
} from "./validateTreatmentFile.ts";
// import { load as loadYaml } from "js-yaml";

// ----------- Reference Schema ------------
test("reference with valid prompt", () => {
  const reference = "prompt.namedPrompt";
  const result = referenceSchema.safeParse(reference);
  if (!result.success) console.log(result.error);
  expect(result.success).toBe(true);
});

test("reference with valid survey", () => {
  const reference = "survey.namedSurvey.results.namedResult";
  const result = referenceSchema.safeParse(reference);
  if (!result.success) console.log(result.error);
  expect(result.success).toBe(true);
});

test("reference with invalid type", () => {
  const reference = "duck.namedPrompt";
  const result = referenceSchema.safeParse(reference);
  if (!result.success)
    console.log(result.error.message, "\npath:", result.error.path);
  expect(result.success).toBe(false);
});

test("reference prompt with no name", () => {
  const reference = "prompt";
  const result = referenceSchema.safeParse(reference);
  if (!result.success)
    console.log(result.error.message, "\npath:", result.error.path);
  expect(result.success).toBe(false);
});

test("reference survey with no path", () => {
  const reference = "survey.namedSurvey";
  const result = referenceSchema.safeParse(reference);
  if (!result.success) console.log(result.error);
  expect(result.success).toBe(false);
});

// ----------- Condition Schema ------------

test("validCondition", () => {
  const condition = {
    reference: "prompt.namedPrompt",
    position: 1,
    comparator: "equals",
    value: "value",
  };
  const result = conditionSchema.safeParse(condition);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("condition missing required value", () => {
  const condition = {
    reference: "duck.namedPrompt",
    position: 1,
    comparator: "matches",
  };
  const result = conditionSchema.safeParse(condition);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(false);
});

test("condition in intro valid", () => {
  const condition = {
    reference: "prompt.namedPrompt",
    comparator: "equals",
    value: "value",
  };
  const result = introConditionSchema.safeParse(condition);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("condition in intro errors on position", () => {
  const condition = {
    reference: "prompt.namedPrompt",
    comparator: "equals",
    value: "value",
    position: 1,
  };
  const result = introConditionSchema.safeParse(condition);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(false);
});

// ----------- Element Schema ------------
test("element validation", () => {
  const element = {
    type: "prompt",
    name: "namedPrompt",
    file: "projects/example/testDisplay00.md",
    conditions: [
      {
        reference: "prompt.namedPrompt",
        position: 1,
        comparator: "equals",
        value: "value",
      },
      {
        reference: "prompt.namedPrompt",
        position: 2,
        comparator: "equals",
        value: "value2",
      },
    ],
  };
  const result = elementSchema.safeParse(element);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});
