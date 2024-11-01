/* eslint-disable no-template-curly-in-string */

import { expect, test } from "vitest";

import {
  referenceSchema,
  conditionSchema,
  elementsSchema,
  promptSchema,
  topSchema,
} from "./validateTreatmentFile.ts";

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

// test("condition in intro valid", () => {
//   const condition = {
//     reference: "prompt.namedPrompt",
//     comparator: "equals",
//     value: "value",
//   };
//   const result = introConditionSchema.safeParse(condition);
//   if (!result.success) console.log(result.error.message);
//   expect(result.success).toBe(true);
// });

// test("condition in intro errors on position", () => {
//   const condition = {
//     reference: "prompt.namedPrompt",
//     comparator: "equals",
//     value: "value",
//     position: 1,
//   };
//   const result = introConditionSchema.safeParse(condition);
//   if (!result.success) console.log(result.error.message);
//   expect(result.success).toBe(false);
// });

// ----------- Small schemas ------------

test("break name requirements", () => {
  const element = {
    type: "prompt",
    name: "This name has !!! some serious \\ issues that *(&@#$( need fixing 123 and change to fill in the 64 character limit etc etc etc etc",
    file: "projects/example/testDisplay00.md",
  };
  const result = promptSchema.safeParse(element);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(false);
});

// ----------- Element schemas ------------
test("prompt element validation", () => {
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
  const result = promptSchema.safeParse(element);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("audio element validation", () => {
  const elements = [
    {
      type: "audio",
      file: "projects/shared/chime.mp3",
    },
  ];
  const result = elementsSchema.safeParse(elements);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("multiple elements validation", () => {
  const elements = [
    {
      type: "prompt",
      file: "projects/example/testDisplay00.md",
    },
    {
      type: "prompt",
      name: "namedPrompt2",
      file: "projects/example/testDisplay01.md",
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
    },
  ];
  const result = elementsSchema.safeParse(elements);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("validate entire file", () => {
  const fileJson = {
    templates: [
      {
        templateName: "template1",
        templateContent: {
          type: "prompt",
          name: "namedPrompt",
          file: "projects/example/testDisplay00.md",
        },
      },
    ],
    introSequences: [
      {
        name: "intro1",
        introSteps: [
          {
            name: "introStep1",
            elements: [
              {
                type: "prompt",
                name: "namedPrompt",
                file: "projects/example/testDisplay00.md",
                conditions: [
                  {
                    reference: "prompt.namedPrompt",
                    comparator: "equals",
                    value: "value",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    treatments: [
      {
        name: "treatment1",
        playerCount: 2,
        groupComposition: [
          {
            position: 0,
            title: "Bill",
          },
          {
            position: 1,
            title: "Ted",
          },
        ],
        gameStages: [
          {
            name: "stage1",
            duration: 10,
            elements: [
              {
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
              },
              {
                type: "prompt",
                name: "namedPrompt2",
                file: "projects/example/testDisplay01.md",
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
              },
            ],
          },
        ],
      },
    ],
  };

  const result = topSchema.safeParse(fileJson);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});
