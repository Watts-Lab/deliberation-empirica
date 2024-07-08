import { z } from "zod";

function isValidRegex(pattern: string): boolean {
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

const refineCondition = (obj: any, ctx: any) => {
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

// Do we have a separate type schema? or do we include it in the individual element types?
// maybe just make it a dropdown in the researcher portal
const typeSchema = z.string().min(1, "Type is required");

// --------------- Little Schemas --------------- //
// can be used in form validation

// TODO: check that file exists
export const fileSchema = z.string().optional();

// TODO: check that url is a valid url
export const urlSchema = z.string().url();

// Names should have properties:
// max length: 64 characters
// min length: 1 character
// allowed characters: a-z, A-Z, 0-9, -, _, and space
export const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(64)
  .regex(/^[a-zA-Z0-9-_ ]+$/);


// stage duration:
// min: 1 second
// max: 1 hour
export const durationSchema = z
  .number()
  .int()
  .positive()
  .max(3600, "Duration must be less than 3600 seconds");

export type DurationType = z.infer<typeof durationSchema>;

// Description is optional
export const descriptionSchema = z.string();

//display time should have these properties:
// min: 1 sec
// max: 1 hour
export const displayTimeSchema = z
  .number()
  .int()
  .positive()
  .max(3600, "Duration must be less than 1 hour");

// hideTime should have these properties:
// min: 1 sec
// max: 1 hour
export const hideTimeSchema = z
  .number()
  .int()
  .positive()
  .max(3600, "Duration must be less than 1 hour");

export const positionSchema = z.number().int().positive();

export const positionSelectorSchema = z
  .enum(["shared", "player", "all"])
  .or(positionSchema)
  .default("player");

// showToPositions is a list of nonnegative integers
// and are unique
export const showToPositionsSchema = z.array(positionSchema).nonempty(); // TODO: check for unique values (or coerce to unique values)
// .unique();

// hideFromPositions is a list of nonnegative integers
// and are unique
export const hideFromPositionsSchema = z.array(positionSchema).nonempty(); // TODO: check for unique values (or coerce to unique values)
// .unique();

export const discussionSchema = z.object({
  chatType: z.enum(["text", "audio", "video"]),
  showNickname: z.boolean(),
  showTitle: z.boolean(),
});

// ------------------ Elements ------------------ //

export const elementSchema = z
  .object({
    name: nameSchema.optional(),
    desc: descriptionSchema.optional(),
    file: fileSchema.optional(),
    displayTime: displayTimeSchema.optional(),
    hideTime: hideTimeSchema.optional(),
    showToPositions: showToPositionsSchema.optional(),
    hideFromPositions: hideFromPositionsSchema.optional(),
    conditions: z.array(conditionSchema).optional(),
  })
  .strict();

export type ElementType = z.infer<typeof elementSchema>;

export const audioSchema = elementSchema.extend({
  type: z.literal("audio"),
  file: fileSchema,
  // Todo: check that file exists
});

export const displaySchema = elementSchema.extend({
  type: z.literal("display"),
  reference: referenceSchema,
  position: positionSelectorSchema,
});

export const promptSchema = elementSchema.extend({
  type: z.literal("prompt"),
  file: fileSchema,
  shared: z.boolean().optional(),
});

export const promptShorthandSchema = fileSchema.transform((str) => {
  const newElement = {
    type: "prompt",
    file: str,
  };
  return newElement;
});

export const qualtricsSchema = elementSchema.extend({
  type: z.literal("qualtrics"),
  url: urlSchema,
  params: z.array(z.record(z.string().or(z.number()))).optional(),
});

export const separatorSchema = elementSchema.extend({
  type: z.literal("separator"),
  style: z.enum(["thin", "thick", "regular"]).optional(),
});

export const sharedNotepadSchema = elementSchema.extend({
  type: z.literal("sharedNotepad"),
});

export const submitButtonSchema = elementSchema.extend({
  type: z.literal("submitButton"),
  buttonText: z.string().max(32).optional(),
});

export const surveySchema = elementSchema.extend({
  type: z.literal("survey"),
  surveyName: z.string(),
  // Todo: check that surveyName is a valid survey name
});

export const talkMeterSchema = elementSchema.extend({
  type: z.literal("talkMeter"),
});

export const timerSchema = elementSchema.extend({
  type: z.literal("timer"),
  startTime: z.number().gt(0).optional(),
  endTime: z.number().gt(0).optional(),
  warnTimeRemaining: z.number().gt(0).optional(),
  // Todo: check that startTime < endTime
  // Todo: check that warnTimeRemaining < endTime - startTime
});

export const videoSchema = elementSchema.extend({
  type: z.literal("video"),
  url: z.string().url(),
  // Todo: check that url is a valid url
});

export const elementsSchema = z
  .array(
    z.discriminatedUnion("type", [
      audioSchema,
      displaySchema,
      promptSchema,
      qualtricsSchema,
      separatorSchema,
      sharedNotepadSchema,
      submitButtonSchema,
      surveySchema,
      talkMeterSchema,
      timerSchema,
      videoSchema,
    ])
    // .or(promptShorthandSchema)
  )
  .nonempty();

export const stageSchema = z
  .object({
    name: nameSchema,
    desc: descriptionSchema.optional(),
    discussion: discussionSchema.optional(),
    duration: durationSchema,
    elements: elementsSchema,
  })
  .strict();

export type StageType = z.infer<typeof stageSchema>;

export const existStepSchema = z
  .object({
    name: nameSchema,
    desc: descriptionSchema.optional(),
    elements: elementsSchema,
  })
  .strict();

export const playerSchema = z
  .object({
    desc: descriptionSchema.optional(),
    position: positionSchema,
    title: z.string().max(25).optional(),
    conditions: z.array(conditionSchema).optional(),
  })
  .strict();

export const treatmentSchema = z
  .object({
    name: nameSchema,
    desc: descriptionSchema.optional(),
    playerCount: z.number(),
    groupComposition: z.array(playerSchema).optional(),
    gameStages: z.array(stageSchema),
    exitSequence: z.array(existStepSchema).nonempty().optional(),
  })
  .strict();

  export type TreatmentType = z.infer<typeof treatmentSchema>;

// refinement for treatment schema
// - all showToPositions and hideFromPositions should be less than playerCount
// - if groupComposition is provided, it should include exactly one position for each player in playerCount
// - all references have associated name elements
// - check that position is a valid position

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

// ------------------ Templates ------------------ //
const templateFieldKeysSchema = z
  .string()
  .regex(/^(?!d[0-9]+)[a-zA-Z0-9_]+$/, {
    message:
      "String must only contain alphanumeric characters and underscores, and not overwrite the broadcast dimension keys `d0`, `d1`, etc.",
  })
  .min(1);
// todo: check that the researcher doen't try to overwrite the dimension keys (d0, d1, etc.)

const templateFieldsSchema = z.record(templateFieldKeysSchema, z.any()); // Todo: the value types could be built up from the other schemas here

const templateBroadcastAxisNameSchema = z.string().regex(/^d\d+$/, {
  message: "String must start with 'd' followed by a nonnegative integer",
});

const templateBroadcastAxisValuesSchema = z.lazy(() =>
  z.array(templateFieldsSchema).nonempty().or(templateContextSchema)
);

export const templateContextSchema = z.object({
  template: z.string(),
  fields: templateFieldsSchema.optional(),
  broadcast: z
    .record(templateBroadcastAxisNameSchema, templateBroadcastAxisValuesSchema)
    .optional(),
});

export const templateSchema = z.object({
  templateName: z.string(),
  templateDesc: z.string(),
});

// Todo: Check that intro and exit stages that don't have a survey or qualtrics or video have a submit button
