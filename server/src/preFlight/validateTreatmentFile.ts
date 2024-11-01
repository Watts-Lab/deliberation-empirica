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

// --------------- Little Schemas --------------- //
// can be used in form validation

// Names should have properties:
// max length: 64 characters
// min length: 1 character
// allowed characters: a-z, A-Z, 0-9, -, _, and space
export const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(64)
  .regex(/^[a-zA-Z0-9-_ ]+$/);
export type NameType = z.infer<typeof nameSchema>;

export const descriptionSchema = z.string();
export type DescriptionType = z.infer<typeof descriptionSchema>;


// TODO: check that file exists
export const fileSchema = z.string().optional();
export type FileType = z.infer<typeof fileSchema>;

// TODO: check that url is a valid url
export const urlSchema = z.string().url();
export type UrlType = z.infer<typeof urlSchema>;

// stage duration:
// min: 1 second
// max: 1 hour
export const durationSchema = z
  .number()
  .int()
  .positive()
  .max(3600, "Duration must be less than 3600 seconds");
export type DurationType = z.infer<typeof durationSchema>;

//display time should have these properties:
// min: 1 sec
// max: 1 hour
export const displayTimeSchema = z
  .number()
  .int()
  .nonnegative()
  .max(3600, "Duration must be less than 1 hour");
export type DisplayTimeType = z.infer<typeof displayTimeSchema>;

// hideTime should have these properties:
// min: 1 sec
// max: 1 hour
export const hideTimeSchema = z
  .number()
  .int()
  .positive()
  .max(3600, "Duration must be less than 1 hour");
export type HideTimeType = z.infer<typeof hideTimeSchema>;

export const positionSchema = z.number().int().nonnegative();
export type PositionType = z.infer<typeof positionSchema>;

export const positionSelectorSchema = z
  .enum(["shared", "player", "all"])
  .or(positionSchema)
  .default("player");
export type PositionSelectorType = z.infer<typeof positionSelectorSchema>;

// showToPositions is a list of nonnegative integers
// and are unique
export const showToPositionsSchema = z.array(positionSchema).nonempty(); // TODO: check for unique values (or coerce to unique values)
export type ShowToPositionsType = z.infer<typeof showToPositionsSchema>;

// hideFromPositions is a list of nonnegative integers
// and are unique
export const hideFromPositionsSchema = z.array(positionSchema).nonempty(); // TODO: check for unique values (or coerce to unique values)
export type HideFromPositionsType = z.infer<typeof hideFromPositionsSchema>;

export const discussionSchema = z.object({
  chatType: z.enum(["text", "audio", "video"]),
  showNickname: z.boolean(),
  showTitle: z.boolean(),
});
export type DiscussionType = z.infer<typeof discussionSchema>;


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
      case "participantInfo":
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

export type ReferenceType = z.infer<typeof referenceSchema>;


// --------------- Conditions --------------- //

const baseConditionSchema = z.object({
  reference: referenceSchema,
  position: z // todo: superrefine this somewhere so that it only exists in game stages, not in intro or exit steps
      .enum(["shared", "player", "all", "percentAgreement"])
      .or(z.number().nonnegative().int())
      .optional(),
});

const conditionExistsSchema = baseConditionSchema.extend({
  comparator: z.literal("exists"),
  value: z.undefined(),
}).strict();

const conditionDoesNotExistSchema = baseConditionSchema.extend({
  comparator: z.literal("doesNotExist"),
  value: z.undefined(),
}).strict();

const conditionEqualsSchema = baseConditionSchema.extend({
  comparator: z.literal("equals"),
  value: z.string().or(z.number()),
}).strict();

const conditionDoesNotEqualSchema = baseConditionSchema.extend({
  comparator: z.literal("doesNotEqual"),
  value: z.string().or(z.number()),
}).strict();

const conditionIsAboveSchema = baseConditionSchema.extend({
  comparator: z.literal("isAbove"),
  value: z.number(),
}).strict();

const conditionIsBelowSchema = baseConditionSchema.extend({
  comparator: z.literal("isBelow"),
  value: z.number(),
}).strict();

const conditionIsAtLeastSchema = baseConditionSchema.extend({
  comparator: z.literal("isAtLeast"),
  value: z.number(),
}).strict();

const conditionIsAtMostSchema = baseConditionSchema.extend({
  comparator: z.literal("isAtMost"),
  value: z.number(),
}).strict();

const conditionHasLengthAtLeastSchema = baseConditionSchema.extend({
  comparator: z.literal("hasLengthAtLeast"),
  value: z.number().nonnegative().int(),
}).strict();

const conditionHasLengthAtMostSchema = baseConditionSchema.extend({
  comparator: z.literal("hasLengthAtMost"),
  value: z.number().nonnegative().int(),
}).strict();

const conditionIncludesSchema = baseConditionSchema.extend({
  comparator: z.literal("includes"),
  value: z.string(),
}).strict();

const conditionDoesNotIncludeSchema = baseConditionSchema.extend({
  comparator: z.literal("doesNotInclude"),
  value: z.string(),
}).strict();

// todo: extend this to include regex validation
const conditionMatchesSchema = baseConditionSchema.extend({
  comparator: z.literal("matches"),
  value: z.string(),
}).strict();

const conditionDoesNotMatchSchema = baseConditionSchema.extend({
  comparator: z.literal("doesNotMatch"),
  value: z.string(),
}).strict();

const conditionIsOneOfSchema = baseConditionSchema.extend({
  comparator: z.literal("isOneOf"),
  value: z.array(z.string().or(z.number())).nonempty(),
}).strict();

const conditionIsNotOneOfSchema = baseConditionSchema.extend({
  comparator: z.literal("isNotOneOf"),
  value: z.array(z.string().or(z.number())).nonempty(),
}).strict();



// const refineCondition = (obj: any, ctx: any) => {
//   const { comparator, value } = obj;
//   if (!["exists", "doesNotExist"].includes(comparator) && value === undefined) {
//     ctx.addIssue({
//       code: z.ZodIssueCode.custom,
//       message: `Value is required for '${comparator}'`,
//       path: ["value"],
//     });
//   }

//   if (["isOneOf", "isNotOneOf"].includes(comparator) && !Array.isArray(value)) {
//     ctx.addIssue({
//       code: z.ZodIssueCode.invalid_type,
//       expected: "array",
//       received: typeof value,
//       message: `Value must be an array for '${comparator}'`,
//       path: ["value"],
//     });
//   }

//   if (
//     [
//       "hasLengthAtLeast",
//       "hasLengthAtMost",
//       "isAbove",
//       "isBelow",
//       "isAtLeast",
//       "isAtMost",
//     ].includes(comparator) &&
//     typeof value !== "number"
//   ) {
//     ctx.addIssue({
//       code: z.ZodIssueCode.invalid_type,
//       expected: "number",
//       received: typeof value,
//       message: `Value must be a number for '${comparator}'`,
//       path: ["value"],
//     });
//   }

//   if (
//     ["hasLengthAtLeast", "hasLengthAtMost"].includes(comparator) &&
//     typeof value === "number" &&
//     value < 0
//   ) {
//     ctx.addIssue({
//       code: z.ZodIssueCode.too_small,
//       type: "number",
//       minimum: 0,
//       inclusive: false,
//       message: `Value must be a positive number for '${comparator}'`,
//       path: ["value"],
//     });
//   }

//   if (
//     ["includes", "doesNotInclude"].includes(comparator) &&
//     typeof value !== "string"
//   ) {
//     ctx.addIssue({
//       code: z.ZodIssueCode.invalid_type,
//       expected: "string",
//       received: typeof value,
//       message: `Value must be a string for '${comparator}'`,
//       path: ["value"],
//     });
//   }

//   if (
//     ["matches", "doesNotMatch"].includes(comparator) &&
//     (typeof value !== "string" || !isValidRegex(value))
//   ) {
//     ctx.addIssue({
//       code: z.ZodIssueCode.custom,
//       message: `Value must be a valid regex expression for '${comparator}'`,
//       path: ["value"],
//     });
//   }
// };

// Modify `comparator` validation in `conditionSchema` to trigger more specific errors
// const validComparators = [
//   "exists",
//   "doesNotExist",
//   "equals",
//   "doesNotEqual",
//   "isAbove",
//   "isBelow",
//   "isAtLeast",
//   "isAtMost",
//   "hasLengthAtLeast",
//   "hasLengthAtMost",
//   "includes",
//   "doesNotInclude",
//   "matches",
//   "doesNotMatch",
//   "isOneOf",
//   "isNotOneOf",
// ];

// const baseConditionSchema = z
//   .object({
//     reference: referenceSchema,
//     comparator: z.enum(validComparators).superRefine((comp, ctx) => {
//       if (!validComparators.includes(comp)) {
//         ctx.addIssue({
//           code: z.ZodIssueCode.custom,
//           message: `Invalid comparator '${comp}'`,
//           path: ["comparator"],
//         });
//       }
//     }),
//     value: z
//       .number()
//       .or(z.string())
//       .or(z.array(z.string().or(z.number())))
//       .or(z.boolean())
//       .optional(),
//   })
//   .strict()
//   .superRefine(refineCondition); // keep the rest of refine logic in `refineCondition`

// export const introConditionSchema = baseConditionSchema;

// export type IntroConditionType = z.infer<typeof introConditionSchema>;

// const validComparators = [
//   "exists",
//   "doesNotExist",
//   "equals",
//   "doesNotEqual",
//   "isAbove",
//   "isBelow",
//   "isAtLeast",
//   "isAtMost",
//   "hasLengthAtLeast",
//   "hasLengthAtMost",
//   "includes",
//   "doesNotInclude",
//   "matches",
//   "doesNotMatch",
//   "isOneOf",
//   "isNotOneOf",
// ] as const;

// const baseConditionSchema = z
//   .object({
//     reference: referenceSchema,
//     comparator: z.enum(validComparators),
//     value: z
//       .number()
//       .or(z.string())
//       .or(z.array(z.string().or(z.number())))
//       .or(z.boolean())
//       .optional(),
//   })
//   .strict();

// export const introConditionSchema =
//   baseConditionSchema.superRefine(refineCondition);

// export type IntroConditionType = z.infer<typeof introConditionSchema>;

// export const conditionSchema = baseConditionSchema
//   .extend({
//     position: z
//       .enum(["shared", "player", "all", "percentAgreement"])
//       .or(z.number().nonnegative().int())
//       .default("player"),
//   })
//   .superRefine(refineCondition);

// export type ConditionType = z.infer<typeof conditionSchema>;

export const conditionSchema = z
  .discriminatedUnion("comparator", [
  conditionExistsSchema,
  conditionDoesNotExistSchema,
  conditionEqualsSchema,
  conditionDoesNotEqualSchema,
  conditionIsAboveSchema,
  conditionIsBelowSchema,
  conditionIsAtLeastSchema,
  conditionIsAtMostSchema,
  conditionHasLengthAtLeastSchema,
  conditionHasLengthAtMostSchema,
  conditionIncludesSchema,
  conditionDoesNotIncludeSchema,
  conditionMatchesSchema,
  conditionDoesNotMatchSchema,
  conditionIsOneOfSchema,
  conditionIsNotOneOfSchema,
]);
// export type ConditionType = z.infer<typeof conditionSchema>;

const conditionsSchema = z.array(conditionSchema).nonempty();

// ------------------ Elements ------------------ //

const elementBaseSchema = z
  .object({
    name: nameSchema.optional(),
    desc: descriptionSchema.optional(),
    file: fileSchema.optional(),
    displayTime: displayTimeSchema.optional(),
    hideTime: hideTimeSchema.optional(),
    showToPositions: showToPositionsSchema.optional(),
    hideFromPositions: hideFromPositionsSchema.optional(),
    conditions: conditionsSchema.optional(),
    tags: z.array(z.string()).optional(),
  })
  .strict();

const audioSchema = elementBaseSchema.extend({
  type: z.literal("audio"),
  file: fileSchema,
  // Todo: check that file exists
}).strict();

const imageSchema = elementBaseSchema.extend({
  type: z.literal("image"),
  file: fileSchema,
  // Todo: check that file exists
}).strict();

const displaySchema = elementBaseSchema.extend({
  type: z.literal("display"),
  reference: referenceSchema,
  position: positionSelectorSchema,
}).strict();

const promptSchema = elementBaseSchema.extend({
  type: z.literal("prompt"),
  file: fileSchema,
  shared: z.boolean().optional(),
}).strict();

const promptShorthandSchema = fileSchema.transform((str) => {
  const newElement = {
    type: "prompt",
    file: str,
  };
  return newElement;
});

const qualtricsSchema = elementBaseSchema.extend({
  type: z.literal("qualtrics"),
  url: urlSchema,
  params: z.array(z.record(z.string().or(z.number()))).optional(),
}).strict();

const separatorSchema = elementBaseSchema.extend({
  type: z.literal("separator"),
  style: z.enum(["thin", "thick", "regular"]).optional(),
}).strict();

const sharedNotepadSchema = elementBaseSchema.extend({
  type: z.literal("sharedNotepad"),
}).strict();

const submitButtonSchema = elementBaseSchema.extend({
  type: z.literal("submitButton"),
  buttonText: z.string().max(50).optional(),
}).strict();

const surveySchema = elementBaseSchema.extend({
  type: z.literal("survey"),
  surveyName: z.string(),
  // Todo: check that surveyName is a valid survey name
}).strict();

const talkMeterSchema = elementBaseSchema.extend({
  type: z.literal("talkMeter"),
}).strict();

const timerSchema = elementBaseSchema.extend({
  type: z.literal("timer"),
  startTime: z.number().gt(0).optional(),
  endTime: z.number().gt(0).optional(),
  warnTimeRemaining: z.number().gt(0).optional(),
  // Todo: check that startTime < endTime
  // Todo: check that warnTimeRemaining < endTime - startTime
}).strict();

const videoSchema = elementBaseSchema.extend({
  type: z.literal("video"),
  url: z.string().url(),
  // Todo: check that url is a valid url
}).strict();

export const elementSchema = z
  .discriminatedUnion("type", [
    audioSchema,
    displaySchema,
    imageSchema,
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
  // .or(promptShorthandSchema);
export type ElementType = z.infer<typeof elementSchema>;

export const elementsSchema = z.array(elementSchema).nonempty();
export type ElementsType = z.infer<typeof elementsSchema>;

// ------------------ Stages ------------------ //

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

export const introExitStepSchema = z
  .object({
    name: nameSchema,
    desc: descriptionSchema.optional(),
    elements: elementsSchema,
  })
  .strict();

// Todo: add a superrefine that checks that no conditions have position values
// and that no elements have showToPositions or hideFromPositions

export type IntroExitStepType = z.infer<typeof introExitStepSchema>;

export const playerSchema = z
  .object({
    desc: descriptionSchema.optional(),
    position: positionSchema,
    title: z.string().max(25).optional(),
    conditions: z.array(conditionSchema).optional(),
  })
  .strict();
export type PlayerType = z.infer<typeof playerSchema>;

export const treatmentSchema = z
  .object({
    name: nameSchema,
    desc: descriptionSchema.optional(),
    playerCount: z.number(),
    groupComposition: z.array(playerSchema).optional(),
    gameStages: z.array(stageSchema),
    exitSequence: z.array(introExitStepSchema).nonempty().optional(),
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

const templateBroadcastAxisValuesSchema: any = z.lazy(() =>
  z.array(templateFieldsSchema).nonempty().or(templateContextSchema)
);

export const templateContextSchema = z.object({
  template: z.string(),
  fields: templateFieldsSchema.optional(),
  broadcast: z
    .record(templateBroadcastAxisNameSchema, templateBroadcastAxisValuesSchema)
    .optional(),
});
export type TemplateContextType = z.infer<typeof templateContextSchema>;

// list all the possible things that could go into a template
const templateableSchemas = z.union([
  referenceSchema,
  conditionSchema,
  elementSchema,
  stageSchema,
  introExitStepSchema,
  playerSchema,
  treatmentSchema,
]);

// we have to do most of the validation after templates are filled
export const templateSchema = z.object({
  templateName: z.string(),
  templateDesc: z.string().optional(),
  templateContent: z
    .array(templateContextSchema)
    .nonempty()
    .or(templateableSchemas),
});
export type TemplateType = z.infer<typeof templateSchema>;

// Todo: Check that intro and exit stages that don't have a survey or qualtrics or video have a submit button

export const introSequenceSchema = z
  .object({
    name: nameSchema,
    desc: descriptionSchema.optional(),
    introSteps: z.array(introExitStepSchema).nonempty(),
  })
  .strict();
export type IntroSequenceType = z.infer<typeof introSequenceSchema>;

// validate file
export const topSchema = z.object({
  templates: z
    .array(templateSchema)
    .min(1, "Templates cannot be empty")
    .optional(),
  introSequences: z
    .array(introSequenceSchema)
    .nonempty(),
    // .or(templateContextSchema), // this is a problem, need to use superrefine to see what type of thing we're looking at - template, or not.
  treatments: z
    .array(treatmentSchema.or(templateContextSchema))
    .nonempty()
    .or(templateContextSchema),
});
export type TopType = z.infer<typeof topSchema>;
