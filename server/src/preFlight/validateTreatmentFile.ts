import { z, ZodIssue } from "zod";

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

// ------------------ Names, descriptions, and files ------------------ //

const fieldPlaceholderSchema = z.string().regex(/\$\{[a-zA-Z0-9-_ ]+\}/, {
  message: "Field placeholder must be in the format `${fieldKey}`",
});

// Names should have properties:
// max length: 64 characters
// min length: 1 character
// allowed characters: a-z, A-Z, 0-9, -, _, and space
// Todo: allow template fields in a name
export const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(64)
  .regex(/^[a-zA-Z0-9-_ ]*(\$\{[a-zA-Z0-9-_ ]+\})*[a-zA-Z0-9-_ ]*$/, {
    message:
      "Name must be alphanumeric, with optional template fields in the format ${fieldname}",
  });
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
export const durationSchema = z.number().int().positive(); // min: 1 second
export type DurationType = z.infer<typeof durationSchema>;

export const displayTimeSchema = z.number().int().nonnegative();
export type DisplayTimeType = z.infer<typeof displayTimeSchema>;

export const hideTimeSchema = z.number().int().positive();
export type HideTimeType = z.infer<typeof hideTimeSchema>;

export const positionSchema = z.number().int().nonnegative();
export type PositionType = z.infer<typeof positionSchema>;

export const positionSelectorSchema = z
  .enum(["shared", "player", "all", "any"])
  .or(positionSchema)
  .default("player");
export type PositionSelectorType = z.infer<typeof positionSelectorSchema>;

export const showToPositionsSchema = z.array(positionSchema).nonempty(); // TODO: check for unique values (or coerce to unique values)
export type ShowToPositionsType = z.infer<typeof showToPositionsSchema>;

export const hideFromPositionsSchema = z.array(positionSchema).nonempty(); // TODO: check for unique values (or coerce to unique values)
export type HideFromPositionsType = z.infer<typeof hideFromPositionsSchema>;

export const discussionSchema = z
  .object({
    chatType: z.enum(["text", "audio", "video"]),
    showNickname: z.boolean(),
    showTitle: z.boolean(),
  })
  .strict();
export type DiscussionType = z.infer<typeof discussionSchema>;

// ------------------ Template contexts ------------------ //
const templateFieldKeysSchema = z // todo: check that the researcher doesn't try to overwrite the dimension keys (d0, d1, etc.)
  .string()
  // .regex(/^(?!d[0-9]+)[a-zA-Z0-9_]+$/, {
  //   message:
  //     "String must only contain alphanumeric characters and underscores, and not overwrite the broadcast dimension keys `d0`, `d1`, etc.",
  // })
  .regex(/^(?!d[0-9]+$)([a-zA-Z0-9-_ ]+|\$\{[a-zA-Z0-9_]+\})$/, {
    message:
      "Field key must be alphanumeric, may include underscores, dashes, or spaces, or be in the format `${fieldKey}` without conflicting with reserved keys (e.g., `d0`, `d1`, etc.).",
  })
  .min(1);

const templateFieldsSchema = z.record(templateFieldKeysSchema, z.any());

const templateBroadcastAxisNameSchema = z.string().regex(/^d\d+$/, {
  message: "String must start with 'd' followed by a nonnegative integer",
});

const templateBroadcastAxisValuesSchema: any = z.lazy(() =>
  z
    .array(templateFieldsSchema)
    .nonempty()
    .or(templateContextSchema)
    .or(templateFieldKeysSchema)
);

export const templateContextSchema = z
  .object({
    template: nameSchema,
    fields: templateFieldsSchema.optional(),
    broadcast: z
      .record(
        templateBroadcastAxisNameSchema,
        templateBroadcastAxisValuesSchema
      )
      .optional(),
  })
  .strict();
export type TemplateContextType = z.infer<typeof templateContextSchema>;

// helper function to extend a schema with template context, and
function altTemplateContext<T extends z.ZodTypeAny>(baseSchema: T) {
  return z.any().superRefine((data, ctx) => {
    if (data === undefined) {
      // throw new Error("data is undefined, this should not happen. This is a bug in the schema.");
      // console.log(
      //   "data is undefined, this should not happen. This is a bug in the schema."
      // );
      // return ctx.addIssue({
      //   code: z.ZodIssueCode.custom,
      //   message: "Data is undefined",
      // });
      return;
    }
    // Determine schema based on presence of `template` field

    const schemaToUse =
      data !== null && typeof data === "object" && "template" in data
        ? templateContextSchema
        : baseSchema;
    // console.log("data", data, "schemaToUse", 'template' in data ? "template" : "base");
    const result = schemaToUse.safeParse(data);

    if (!result.success) {
      result.error.issues.forEach((issue) =>
        ctx.addIssue({
          ...issue,
          path: [...issue.path],
        })
      );
    }
  });
}

// ------------------ References ------------------ //

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
            path: [],
          });
        }
        if (name === undefined || name.length < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `A name must be provided, e.g. '${givenType}.elementName.object.selectors.here'`,
            path: [],
          });
        }
        break;
      case "discussion":
      case "participantInfo":
      case "prompt":
        [, name] = arr;
        if (name === undefined || name.length < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `A name must be provided, e.g. '${givenType}.elementName'`,
            path: [],
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
            path: [],
          });
        }
        break;
      default:
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid reference type "${givenType}"`,
          path: [],
        });
    }
  });

export type ReferenceType = z.infer<typeof referenceSchema>;

// --------------- Conditions --------------- //

const baseConditionSchema = z
  .object({
    reference: referenceSchema,
    position: z // todo: superrefine this somewhere so that it only exists in game stages, not in intro or exit steps
      .enum(["shared", "player", "all", "any", "percentAgreement"])
      .or(z.number().nonnegative().int())
      .optional(),
  })
  .strict();

const conditionExistsSchema = baseConditionSchema
  .extend({
    comparator: z.literal("exists"),
    value: z.undefined(),
  })
  .strict();

const conditionDoesNotExistSchema = baseConditionSchema
  .extend({
    comparator: z.literal("doesNotExist"),
    value: z.undefined(),
  })
  .strict();

const conditionEqualsSchema = baseConditionSchema
  .extend({
    comparator: z.literal("equals"),
    value: z.string().or(z.number()).or(z.boolean()).or(fieldPlaceholderSchema),
  })
  .strict();

const conditionDoesNotEqualSchema = baseConditionSchema
  .extend({
    comparator: z.literal("doesNotEqual"),
    value: z.string().or(z.number()).or(z.boolean()).or(fieldPlaceholderSchema),
  })
  .strict();

const conditionIsAboveSchema = baseConditionSchema
  .extend({
    comparator: z.literal("isAbove"),
    value: z.number().or(fieldPlaceholderSchema),
  })
  .strict();

const conditionIsBelowSchema = baseConditionSchema
  .extend({
    comparator: z.literal("isBelow"),
    value: z.number().or(fieldPlaceholderSchema),
  })
  .strict();

const conditionIsAtLeastSchema = baseConditionSchema
  .extend({
    comparator: z.literal("isAtLeast"),
    value: z.number().or(fieldPlaceholderSchema),
  })
  .strict();

const conditionIsAtMostSchema = baseConditionSchema
  .extend({
    comparator: z.literal("isAtMost"),
    value: z.number().or(fieldPlaceholderSchema),
  })
  .strict();

const conditionHasLengthAtLeastSchema = baseConditionSchema
  .extend({
    comparator: z.literal("hasLengthAtLeast"),
    value: z.number().nonnegative().int().or(fieldPlaceholderSchema),
  })
  .strict();

const conditionHasLengthAtMostSchema = baseConditionSchema
  .extend({
    comparator: z.literal("hasLengthAtMost"),
    value: z.number().nonnegative().int().or(fieldPlaceholderSchema),
  })
  .strict();

const conditionIncludesSchema = baseConditionSchema
  .extend({
    comparator: z.literal("includes"),
    value: z.string().or(fieldPlaceholderSchema),
  })
  .strict();

const conditionDoesNotIncludeSchema = baseConditionSchema
  .extend({
    comparator: z.literal("doesNotInclude"),
    value: z.string().or(fieldPlaceholderSchema),
  })
  .strict();

// todo: extend this to include regex validation
const conditionMatchesSchema = baseConditionSchema
  .extend({
    comparator: z.literal("matches"),
    value: z.string().or(fieldPlaceholderSchema),
  })
  .strict();

const conditionDoesNotMatchSchema = baseConditionSchema
  .extend({
    comparator: z.literal("doesNotMatch"),
    value: z.string().or(fieldPlaceholderSchema),
  })
  .strict();

const conditionIsOneOfSchema = baseConditionSchema
  .extend({
    comparator: z.literal("isOneOf"),
    value: z
      .array(z.string().or(z.number()))
      .nonempty()
      .or(fieldPlaceholderSchema),
  })
  .strict();

const conditionIsNotOneOfSchema = baseConditionSchema
  .extend({
    comparator: z.literal("isNotOneOf"),
    value: z
      .array(z.string().or(z.number()))
      .nonempty()
      .or(fieldPlaceholderSchema),
  })
  .strict();

export const conditionSchema = altTemplateContext(
  z.discriminatedUnion("comparator", [
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
  ])
);

export const conditionsSchema = altTemplateContext(
  z.array(conditionSchema).nonempty()
);
export type ConditionType = z.infer<typeof conditionSchema>;

// ------------------ Players ------------------ //

export const playerSchema = z
  .object({
    desc: descriptionSchema.optional(),
    position: positionSchema,
    title: z.string().max(25).optional(),
    conditions: z.array(conditionSchema).optional(),
  })
  .strict();
export type PlayerType = z.infer<typeof playerSchema>;

// ------------------ Elements ------------------ //

const elementBaseSchema = z
  .object({
    name: nameSchema.optional(),
    desc: descriptionSchema.optional(),
    file: fileSchema.or(fieldPlaceholderSchema).optional(),
    displayTime: displayTimeSchema.or(fieldPlaceholderSchema).optional(),
    hideTime: hideTimeSchema.or(fieldPlaceholderSchema).optional(),
    showToPositions: showToPositionsSchema
      .or(fieldPlaceholderSchema)
      .optional(),
    hideFromPositions: hideFromPositionsSchema
      .or(fieldPlaceholderSchema)
      .optional(),
    conditions: conditionsSchema.optional(),
    tags: z.array(z.string()).optional(),
  })
  .strict();

const audioSchema = elementBaseSchema
  .extend({
    type: z.literal("audio"),
    file: fileSchema,
    // Todo: check that file exists
  })
  .strict();

const imageSchema = elementBaseSchema
  .extend({
    type: z.literal("image"),
    file: fileSchema,
    // Todo: check that file exists
  })
  .strict();

const displaySchema = elementBaseSchema
  .extend({
    type: z.literal("display"),
    reference: referenceSchema,
    position: positionSelectorSchema,
  })
  .strict();

export const promptSchema = elementBaseSchema
  .extend({
    type: z.literal("prompt"),
    file: fileSchema,
    shared: z.boolean().optional(),
  })
  .strict();

const promptShorthandSchema = fileSchema.transform((str) => {
  const newElement = {
    type: "prompt",
    file: str,
  };
  return newElement;
});

const qualtricsSchema = elementBaseSchema
  .extend({
    type: z.literal("qualtrics"),
    url: urlSchema,
    params: z.array(z.record(z.string().or(z.number()))).optional(),
  })
  .strict();

const separatorSchema = elementBaseSchema
  .extend({
    type: z.literal("separator"),
    style: z.enum(["thin", "thick", "regular"]).optional(),
  })
  .strict();

const sharedNotepadSchema = elementBaseSchema
  .extend({
    type: z.literal("sharedNotepad"),
  })
  .strict();

const submitButtonSchema = elementBaseSchema
  .extend({
    type: z.literal("submitButton"),
    buttonText: z.string().max(50).optional(),
  })
  .strict();

const surveySchema = elementBaseSchema
  .extend({
    type: z.literal("survey"),
    surveyName: z.string(),
    // Todo: check that surveyName is a valid survey name
  })
  .strict();

const talkMeterSchema = elementBaseSchema
  .extend({
    type: z.literal("talkMeter"),
  })
  .strict();

const timerSchema = elementBaseSchema
  .extend({
    type: z.literal("timer"),
    startTime: z.number().gt(0).optional(),
    endTime: z.number().gt(0).optional(),
    warnTimeRemaining: z.number().gt(0).optional(),
    // Todo: check that startTime < endTime
    // Todo: check that warnTimeRemaining < endTime - startTime
  })
  .strict();

const videoSchema = elementBaseSchema
  .extend({
    type: z.literal("video"),
    url: z.string().url(),
    // Todo: check that url is a valid url
  })
  .strict();

const validElementTypes = [
  "audio",
  "display",
  "image",
  "prompt",
  "qualtrics",
  "separator",
  "sharedNotepad",
  "submitButton",
  "survey",
  "talkMeter",
  "timer",
  "video",
];

export const elementSchema = altTemplateContext(
  z.any().superRefine((data, ctx) => {
    // Check if `data` is an object and has the `type` field
    const hasTypeKey =
      typeof data === "object" && data !== null && "type" in data;

    // Use the discriminated union schema if `type` is present
    const schemaToUse = hasTypeKey
      ? z.discriminatedUnion("type", [
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
      : // Otherwise, use `promptShorthandSchema`
        promptShorthandSchema;

    // Attempt to parse with the chosen schema
    const result = schemaToUse.safeParse(data);

    if (!result.success) {
      // Add each issue from the failed parse attempt to the context for error reporting
      result.error.issues.forEach((issue) =>
        ctx.addIssue({
          ...issue,
          path: [...issue.path],
        })
      );
    }
  })
);

export type ElementType = z.infer<typeof elementSchema>;

export const elementsSchema = altTemplateContext(
  z.array(elementSchema).nonempty()
);
export type ElementsType = z.infer<typeof elementsSchema>;

// ------------------ Stages ------------------ //

export const stageSchema = altTemplateContext(
  z
    .object({
      name: nameSchema,
      desc: descriptionSchema.optional(),
      discussion: discussionSchema.optional(),
      duration: durationSchema.or(fieldPlaceholderSchema),
      elements: elementsSchema,
    })
    .strict()
);
export type StageType = z.infer<typeof stageSchema>;

const stagesSchema = altTemplateContext(z.array(stageSchema).nonempty());

export const introExitStepSchema = altTemplateContext(
  z
    .object({
      name: nameSchema,
      desc: descriptionSchema.optional(),
      elements: elementsSchema,
    })
    .strict()
);
// Todo: add a superrefine that checks that no conditions have position values
// and that no elements have showToPositions or hideFromPositions
export type IntroExitStepType = z.infer<typeof introExitStepSchema>;

export const introExitStepsSchema = altTemplateContext(
  z.array(introExitStepSchema).nonempty()
);

// ------------------ Intro Sequences and Treatments ------------------ //
export const introSequenceSchema = altTemplateContext(
  z
    .object({
      name: nameSchema,
      desc: descriptionSchema.optional(),
      introSteps: introExitStepsSchema,
    })
    .strict()
);
export type IntroSequenceType = z.infer<typeof introSequenceSchema>;

export const introSequencesSchema = altTemplateContext(
  z.array(introSequenceSchema).nonempty()
);

export const treatmentSchema = altTemplateContext(
  z
    .object({
      name: nameSchema,
      desc: descriptionSchema.optional(),
      playerCount: z.number(),
      groupComposition: z.array(playerSchema).optional(),
      gameStages: stagesSchema,
      exitSequence: introExitStepsSchema.optional(),
    })
    .strict()
);
export type TreatmentType = z.infer<typeof treatmentSchema>;

export const treatmentsSchema = altTemplateContext(
  z.array(treatmentSchema).nonempty()
);

// ------------------ Template Schemas ------------------ //
export const templateContentSchema = z.any().superRefine((data, ctx) => {
  const schemas = [
    { schema: introSequenceSchema, name: "Intro Sequence" },
    { schema: introSequencesSchema, name: "Intro Sequences" },
    { schema: treatmentSchema, name: "Treatment" },
    { schema: treatmentsSchema, name: "Treatments" },
    { schema: referenceSchema, name: "Reference" },
    { schema: conditionSchema, name: "Condition" },
    { schema: elementSchema, name: "Element" },
    { schema: elementsSchema, name: "Elements" },
    { schema: stageSchema, name: "Stage" },
    { schema: stagesSchema, name: "Stages" },
    { schema: playerSchema, name: "Player" },
    { schema: introExitStepSchema, name: "Intro Exit Step" },
    { schema: introExitStepsSchema, name: "Intro Exit Steps" },
    {
      schema: templateBroadcastAxisValuesSchema,
      name: "Template Broadcast Axis Values",
    },
  ];

  let bestSchemaResult = null;
  let fewestUnmatchedKeys = Infinity;

  // console.log("\n\n------------------\n\n");

  interface Issue {
    code: string;
    path: any[];
    keys?: string[];
  }
  interface ValidationResult {
    error: {
      issues: Issue[];
    };
  }

  for (const { schema, name } of schemas) {
    const result = schema.safeParse(data);

    if (result.success) {
      // console.log(`Schema "${name}" matched successfully.`);
      return;
    } else {
      // console.log(`Schema "${name}" failed with errors:`, result.error.issues);

      // Check if the root type was valid by looking for type-related issues.
      const rootTypeError = result.error.issues.find(
        (issue: Issue) =>
          issue.code === "invalid_type" && issue.path.length === 0
      );
      if (rootTypeError) {
        // console.log(`Schema "${name}" skipped due to invalid root type.`);
        continue; // Skip schemas with invalid root types.
      }

      // Check if the errors indicate a missing or invalid discriminator key
      const discriminatorIssue = result.error.issues.find(
        (issue: Issue) =>
          issue.code === "invalid_union_discriminator" &&
          issue.path.length === 1
      );

      if (discriminatorIssue !== undefined) {
        // console.log(`Schema "${name}" skipped due to missing or invalid union discriminator.`);
        continue;
      }

      // Count the total number of unrecognized keys
      const unmatchedKeysCount = result.error.issues
        .filter((issue: Issue) => issue.code === "unrecognized_keys")
        .reduce(
          (sum: number, issue: Issue) =>
            sum + (issue.keys ? issue.keys.length : 0),
          0
        );

      if (unmatchedKeysCount < fewestUnmatchedKeys) {
        fewestUnmatchedKeys = unmatchedKeysCount;
        bestSchemaResult = { result, name };
      }
    }
  }

  if (bestSchemaResult) {
    console.log(
      `Best schema match is "${bestSchemaResult.name}" with ${fewestUnmatchedKeys} unmatched keys.`
    );
    bestSchemaResult.result.error.issues.forEach((issue: ZodIssue) => {
      ctx.addIssue({
        ...issue,
        path: issue.path,
        message: `Closest schema match: ${bestSchemaResult.name}. ${issue.message}`,
      });
    });
  } else {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "No schema matched the provided data.",
    });
  }
});

export const templateSchema = z
  .object({
    templateName: nameSchema,
    templateDesc: descriptionSchema.optional(),
    templateContent: templateContentSchema,
  })
  .strict();
export type TemplateType = z.infer<typeof templateSchema>;

// ------------------ Treatment File ------------------ //
export const treatmentFileSchema = z.object({
  templates: z
    .array(templateSchema)
    .min(1, "Templates cannot be empty")
    .optional(),
  introSequences: introSequencesSchema,
  treatments: treatmentsSchema,
});
export type TreatmentFileType = z.infer<typeof treatmentFileSchema>;
