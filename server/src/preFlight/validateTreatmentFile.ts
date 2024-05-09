import { z } from "zod";

function isValidRegex(pattern) {
  try {
    new RegExp(pattern);
    return true;
  } catch (e) {
    if (e instanceof SyntaxError) {
      return false;
    }
    throw e;
  }
}

export const referenceSchema = z
  .string()
  .transform((str) => str.split("."))
  .superRefine((arr, ctx) => {
    const [givenType] = arr; // destructure first element
    let name;
    let path;
    switch (givenType) {
      case "survey":
      case "submitButton":
      case "qualtrics":
        [, name, ...path] = arr;
        if (path.length < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `A path must be provided, e.g. '${givenType}.${name}.object.selectors.here'`,
            path: ["path"],
          });
        }
        if (name === undefined || name.length < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `A name must be provided, e.g. '${givenType}.elementName.object.selectors.here'`,
            path: ["name"],
          });
        }
        break;
      case "prompt":
        [, name] = arr;
        if (name === undefined || name.length < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `A name must be provided, e.g. '${givenType}.elementName'`,
            path: ["name"],
          });
        }
        break;
      case "urlParams":
      case "connectionInfo":
      case "browserInfo":
        [, ...path] = arr;
        if (path.length < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `A path must be provided, e.g. '${givenType}.object.selectors.here.`,
            path: ["path"],
          });
        }
        break;
      default:
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid reference type "${givenType}"`,
          path: ["type"],
        });
    }
  });

const refineCondition = (obj, ctx) => {
  const { comparator, value } = obj;
  if (!["exists", "doesNotExist"].includes(comparator) && value === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Value is required for '${comparator}'`,
      path: ["value"],
    });
  }

  if (["isOneOf", "isNotOneOf"].includes(comparator) && !Array.isArray(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.invalid_type,
      expected: "array",
      received: typeof value,
      message: `Value must be an array for '${comparator}'`,
      path: ["value"],
    });
  }

  if (
    [
      "hasLengthAtLeast",
      "hasLengthAtMost",
      "isAbove",
      "isBelow",
      "isAtLeast",
      "isAtMost",
    ].includes(comparator) &&
    typeof value !== "number"
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.invalid_type,
      expected: "number",
      received: typeof value,
      message: `Value must be a number for '${comparator}'`,
      path: ["value"],
    });
  }

  if (
    ["hasLengthAtLeast", "hasLengthAtMost"].includes(comparator) &&
    typeof value == "number" &&
    value < 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.too_small,
      type: "number",
      minimum: 0,
      inclusive: false,
      message: `Value must be a positive number for '${comparator}'`,
      path: ["value"],
    });
  }

  if (
    ["includes", "doesNotInclude"].includes(comparator) &&
    typeof value !== "string"
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.invalid_type,
      expected: "string",
      received: typeof value,
      message: `Value must be a string for '${comparator}'`,
      path: ["value"],
    });
  }

  if (
    ["matches", "doesNotMatch"].includes(comparator) &&
    (typeof value !== "string" || !isValidRegex(value))
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Value must be a valid regex expression for '${comparator}'`,
      path: ["value"],
    });
  }
};

const baseConditionSchema = z
  .object({
    reference: referenceSchema,
    comparator: z.enum([
      "exists",
      "doesNotExist",
      "equals",
      "doesNotEqual",
      "isAbove",
      "isBelow",
      "isAtLeast",
      "isAtMost",
      "hasLengthAtLeast",
      "hasLengthAtMost",
      "includes",
      "doesNotInclude",
      "matches",
      "doesNotMatch",
      "isOneOf",
      "isNotOneOf",
    ]),
    value: z
      .number()
      .or(z.string())
      .or(z.array(z.string().or(z.number())))
      .optional(),
  })
  .strict();

export const introConditionSchema =
  baseConditionSchema.superRefine(refineCondition);

export const conditionSchema = baseConditionSchema
  .extend({
    position: z
      .enum(["shared", "player", "all"])
      .or(z.number().nonnegative().int())
      .default("player"),
  })
  .superRefine(refineCondition);

// export const introSequenceSchema = z.object({});

export const elementSchema = z.object({
  name: z.string().optional(),
  desc: z.string().optional(),

  displayTime: z.number().nonnegative().optional(),
  hideTime: z.number().gt(0).optional(),
  showToPositions: z.array(z.number()).optional(),
  hideFromPositions: z.array(z.number()).optional(),
  conditions: z.array(conditionSchema).optional(),
  shared: z.boolean().optional(),
});

// export const audioSchema = elementSchema.extend({
//   type: z.literal("audio"),
//   file: z.string(),
//   // Todo: check that file exists
// });

// export const displaySchema = elementSchema.extend({
//   type: z.literal("display"),
//   promptName: z.string(),
//   position: z
//     .enum(["shared", "player", "all"])
//     .or(z.number().nonnegative().int())
//     .default("player"),
//   // Todo: check that promptName is a valid prompt name
//   // Todo: check that position is a valid position
// });

// export const promptSchema = elementSchema.extend({
//   type: z.literal("prompt"),
//   file: z.string(),
//   shared: z.boolean().optional(),
//   // Todo: check that file exists
// });

// export const promptShorthandSchema = z.string().transform((str) => {
//   const newElement = {
//     type: "prompt",
//     file: str,
//   };
//   return newElement;
// });

// export const qualtricsSchema = elementSchema.extend({
//   type: z.literal("qualtrics"),
//   url: z.string(),
//   params: z.array(z.record(z.string().or(z.number()))).optional(),
// });

// export const separatorSchema = elementSchema.extend({
//   type: z.literal("separator"),
//   style: z.enum(["thin", "thick", "regular"]).optional(),
// });

// export const sharedNotepadSchema = elementSchema.extend({
//   type: z.literal("sharedNotepad"),
// });

// export const submitButtonSchema = elementSchema.extend({
//   type: z.literal("submitButton"),
//   buttonText: z.string().optional(),
// });

// export const surveySchema = elementSchema.extend({
//   type: z.literal("survey"),
//   surveyName: z.string(),
//   // Todo: check that surveyName is a valid survey name
// });

// export const talkMeterSchema = elementSchema.extend({
//   type: z.literal("talkMeter"),
// });

// export const timerSchema = elementSchema.extend({
//   type: z.literal("timer"),
//   startTime: z.number().gt(0).optional(),
//   endTime: z.number().gt(0).optional(),
//   warnTimeRemaining: z.number().gt(0).optional(),
//   // Todo: check that startTime < endTime
//   // Todo: check that warnTimeRemaining < endTime - startTime
// });

// export const videoSchema = elementSchema.extend({
//   type: z.literal("video"),
//   url: z.string().url(),
//   // Todo: check that url is a valid url
// });

// export const treatmentSchema = z
//   .object({
//     name: z.string(),
//     desc: z.string().optional(),
//     playerCount: z.number(),
//     groupComposition: z
//       .array(
//         z.object({
//           desc: z.string().optional(),
//           position: z.number().nonnegative().int(),
//           title: z.string().optional(),
//         })
//       )
//       .optional(),
//     gameStages: z.array(
//       z.object({
//         name: z.string(),
//         duration: z.number().gt(0),
//         desc: z.string().optional(),
//         elements: z
//           .array(
//             z
//               .discriminatedUnion("type", [
//                 audioSchema,
//                 displaySchema,
//                 promptSchema,
//                 qualtricsSchema,
//                 separatorSchema,
//                 sharedNotepadSchema,
//                 submitButtonSchema,
//                 surveySchema,
//                 talkMeterSchema,
//                 timerSchema,
//                 videoSchema,
//               ])
//               .or(promptShorthandSchema)
//           )
//           .nonempty(),
//       })
//     ),
//     exitSequence: z
//       .array(
//         z.object({
//           name: z.string(),
//           desc: z.string().optional(),
//           elements: z
//             .array(
//               z
//                 .discriminatedUnion("type", [
//                   audioSchema,
//                   displaySchema,
//                   promptSchema,
//                   qualtricsSchema,
//                   separatorSchema,
//                   sharedNotepadSchema,
//                   submitButtonSchema,
//                   surveySchema,
//                   talkMeterSchema,
//                   timerSchema,
//                   videoSchema,
//                 ])
//                 .or(promptShorthandSchema)
//             )
//             .nonempty(),
//         })
//       )
//       .optional(),
//   })
//   .strict();
