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
  .regex(/^(?:[a-zA-Z0-9 _-]|\$\{[a-zA-Z0-9_]+\})+$/, {
    message:
      "Name must be alphanumeric, cannot have special characters, with optional template fields in the format ${fieldname}",
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

export const showToPositionsSchema = z.array(positionSchema, {
  required_error: "Expected an array for `showToPositions`. Make sure each item starts with a dash (`-`) in YAML.",
  invalid_type_error: "Expected an array for `showToPositions`. Make sure each item starts with a dash (`-`) in YAML.",
}).nonempty(); // TODO: check for unique values (or coerce to unique values)
export type ShowToPositionsType = z.infer<typeof showToPositionsSchema>;

export const hideFromPositionsSchema = z.array(positionSchema, {
  required_error: "Expected an array for `hideFromPositions`. Make sure each item starts with a dash (`-`) in YAML.",
  invalid_type_error: "Expected an array for `hideFromPositions`. Make sure each item starts with a dash (`-`) in YAML.",
}).nonempty(); // TODO: check for unique values (or coerce to unique values)
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
  .min(1)
  .superRefine((val, ctx) => {
    //we do not want all template content data to default to template broadcast axis values schema,
    //so we add this conditon to have the closest match be elementSchema in templateContentSchema if field 'type' is used
    if (val == "type") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Field key cannot be 'type', as it is reserved for element types.",
      })
    }
  });

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

export const coreReferenceSchema = z
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
          message: `Invalid reference type "${givenType}", need to be in form of a valid reference type such as 'survey', 'submitButton', 'qualtrics', 'discussion', 'participantInfo', 'prompt', 'urlParams', 'connectionInfo', or 'browserInfo' followed by a . and name or path.`,
          path: [],
        });
    }
  });

// Final schema accepts either coreReference OR prefixed reference
export const referenceSchema = z.string().superRefine((str, ctx) => {
  const prefixMatch = str.match(
    /^(p_\d+|shared|any|all|percentAgreement)\.(.+)$/
  );
  if (prefixMatch) {
    const [, prefix, rest] = prefixMatch;
    const result = coreReferenceSchema.safeParse(rest);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue(issue); // forward issues from core schema
      }
    }
    return;
  }

  const result = coreReferenceSchema.safeParse(str);
  if (!result.success) {
    for (const issue of result.error.issues) {
      ctx.addIssue(issue);
    }
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
  z.array(conditionSchema, {
    required_error: "Expected an array for `conditions`. Make sure each item starts with a dash (`-`) in YAML.",
    invalid_type_error: "Expected an array for `conditions`. Make sure each item starts with a dash (`-`) in YAML.",
  }).nonempty()
);
export type ConditionType = z.infer<typeof conditionSchema>;

// ------------------ Players ------------------ //

export const playerSchema = z
  .object({
    desc: descriptionSchema.optional(),
    position: positionSchema,
    title: z.string().max(25).optional(),
    conditions: z.array(conditionSchema, {
      invalid_type_error: "Expected an array for `conditions`. Make sure each item starts with a dash (`-`) in YAML.",
    }).optional(),
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
    tags: z.array(z.string(), {
      invalid_type_error: "Expected an array for `tags`. Make sure each item starts with a dash (`-`) in YAML.",
    }).optional(),
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
    params: z.array(z.record(z.string().or(z.number())), {
      invalid_type_error: "Expected an array for `params`. Make sure each item starts with a dash (`-`) in YAML.",
    }).optional(),
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
    const isObject = typeof data === "object" && data !== null;
    const hasTypeKey = isObject && "type" in data;

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
      : promptShorthandSchema;

    const result = schemaToUse.safeParse(data);

    if (!result.success) {
      //promptShorthandSchema is a special case where we expect a string
      //But there are 0 key mismatches as a result of this for whatever object
      //is input, messes up matching logic in templateContentSchema
      if (!hasTypeKey && isObject && schemaToUse === promptShorthandSchema) {
        // If we expected a string (promptShorthand) but got an object instead
        // Add one error per key
        ctx.addIssue({
          code: "invalid_type",
          expected: "string",
          received: "object",
          message: `promptShorthandSchema expects a string, but received object.`,
        });
        for (const key of Object.keys(data)) {
          ctx.addIssue({
            code: "unrecognized_keys",
            keys: [key],
          });
        }
      } else {
        // Forward errors from schemaToUse
        result.error.issues.forEach((issue) =>
          ctx.addIssue({
            ...issue,
            path: [...issue.path],
          })
        );
      }
    }
  })
);

export type ElementType = z.infer<typeof elementSchema>;

export const elementsSchema = altTemplateContext(
  z.array(elementSchema, {
    required_error: "Expected an array for `elements`. Make sure each item starts with a dash (`-`) in YAML.",
    invalid_type_error: "Expected an array for `elements`. Make sure each item starts with a dash (`-`) in YAML.",
  }).nonempty()
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
    .superRefine((data, ctx) => {
      //For some reason, above conditions are bypassing the strict check
      // so we add a superRefine to check that elements field exists
      if (!data.elements) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Stage must have elements field (check elementsSchema).",
        })
      }
    }
    )
);
export type StageType = z.infer<typeof stageSchema>;

const stagesSchema = altTemplateContext(z.array(stageSchema, {
  required_error: "Expected an array for `stages`. Make sure each item starts with a dash (`-`) in YAML.",
  invalid_type_error: "Expected an array for `stages`. Make sure each item starts with a dash (`-`) in YAML.",
}).nonempty());

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
  z.array(introExitStepSchema, {
    required_error: "Expected an array for `introSteps`. Make sure each item starts with a dash (`-`) in YAML.",
    invalid_type_error: "Expected an array for `introSteps`. Make sure each item starts with a dash (`-`) in YAML.",
  }).nonempty()
);

// ------------------ Intro Sequences and Treatments ------------------ //
export const introSequenceSchema = altTemplateContext(
  z
    .object({
      name: nameSchema,
      desc: descriptionSchema.optional(),
      introSteps: introExitStepsSchema,
    }).strict()
);
export type IntroSequenceType = z.infer<typeof introSequenceSchema>;

export const introSequencesSchema = altTemplateContext(
  z.array(introSequenceSchema, {
    required_error: "Expected an array for `introSequence`. Make sure each item starts with a dash (`-`) in YAML.",
    invalid_type_error: "Expected an array for `introSequence`. Make sure each item starts with a dash (`-`) in YAML.",
  }).nonempty()
);

export const baseTreatmentSchema =
  z.object({
    name: nameSchema,
    desc: descriptionSchema.optional(),
    playerCount: z.number(),
    groupComposition: z.array(playerSchema, {
      invalid_type_error: "Expected an array for `groupComposition`. Make sure each item starts with a dash (`-`) in YAML.",
    }).optional(),
    gameStages: stagesSchema,
    exitSequence: introExitStepsSchema.optional(),
  })
    .strict()


export const treatmentSchema = altTemplateContext(
  baseTreatmentSchema
    //works currently for the case where playerSchema always occurs within a treatmentSchema
    //However if a playerSchema is used outside of a treatmentSchema, this will not work, as playerCount will not be defined in its scope
    //With the current structure of templateSchema, this is hypothetically possible, but unlikely
    .superRefine((treatment, ctx) => {
      const baseResult = baseTreatmentSchema.safeParse(treatment);
      if (!baseResult.success) {
        return;
      }
      const { playerCount, groupComposition, gameStages } = treatment;
      groupComposition?.forEach((player, index) => {
        if (typeof player.position === "number" && player.position >= playerCount) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["groupComposition", index, "position"],
            message: `Player position index ${player.position} in groupComposition exceeds playerCount of ${playerCount}.`,
          });
        }
      });
      gameStages?.forEach((stage: { elements: any[]; name: any; }, stageIndex: string | number) => {
        stage?.elements?.forEach((element: any, elementIndex: string | number) => {
          ["showToPositions", "hideFromPositions"].forEach((key) => {
            const positions = (element as any)[key];
            if (Array.isArray(positions)) {
              positions?.forEach((pos, posIndex) => {
                if (typeof pos === "number" && pos >= playerCount) {
                  ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [
                      "gameStages",
                      stageIndex,
                      "elements",
                      elementIndex,
                      key,
                      posIndex,
                    ],
                    message: `${key} index ${pos} in stage "${stage.name}" exceeds playerCount of ${playerCount}.`,
                  });
                }
              });
            }
          });
        });
      });
    })
);

export type TreatmentType = z.infer<typeof treatmentSchema>;

export const treatmentsSchema = altTemplateContext(
  z.array(treatmentSchema, {
    required_error: "Expected an array for `treatments`. Make sure each item starts with a dash (`-`) in YAML.",
    invalid_type_error: "Expected an array for `treatments`. Make sure each item starts with a dash (`-`) in YAML.",
  }).nonempty()
);

// ------------------ Template Schemas ------------------ //
export const templateContentSchema = z.any().superRefine((data, ctx) => {
  const schemas = [
    { schema: introSequenceSchema, name: "Intro Sequence" },
    { schema: introSequencesSchema, name: "Intro Sequences" },
    { schema: elementsSchema, name: "Elements" },
    { schema: elementSchema, name: "Element" },
    { schema: stageSchema, name: "Stage" },
    { schema: stagesSchema, name: "Stages" },
    { schema: treatmentSchema, name: "Treatment" },
    { schema: treatmentsSchema, name: "Treatments" },
    { schema: referenceSchema, name: "Reference" },
    { schema: conditionSchema, name: "Condition" },
    { schema: playerSchema, name: "Player" },
    { schema: introExitStepSchema, name: "Intro Exit Step" },
    { schema: introExitStepsSchema, name: "Intro Exit Steps" },
    //commented out for now, matches too many schemas
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
      console.log(`Schema "${name}" matched successfully.`);
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

      const promptShorthandIssue = result.error.issues.find(
        (issue: ZodIssue) =>
          issue.code === "invalid_type" &&
          issue.expected === "string" &&
          issue.received === "object" &&
          issue.message === "promptShorthandSchema expects a string, but received object."
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
        if (promptShorthandIssue) {
          continue;
        }
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


//update templateSchema so that content types are defined as a field for easier matching of
//templateContent data to their respective schemas
//contentType is optional for now, but will be required in the future
export const templateSchema = z
  .object({
    templateName: nameSchema,
    contentType: z.enum([
      "introSequence",
      "introSequences",
      "elements",
      "element",
      "stage",
      "stages",
      "treatment",
      "treatments",
      "reference",
      "condition",
      "player",
      "introExitStep",
      "introExitSteps",
      "other",
    ]).optional(),
    templateDesc: descriptionSchema.optional(),
    templateContent: z.any(),
  })
  .strict().superRefine((data, ctx) => {

    if (!data.contentType) {
      const res = templateContentSchema.safeParse(data.templateContent);
      if (!res.success) {
        res.error.issues.forEach((issue) =>
          ctx.addIssue({
            ...issue,
            path: ["templateContent", ...issue.path],
          })
        );
      }

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "contentType field is required. Please specify a valid content type. Valid content types are 'introSequence', 'introSequences', 'elements', 'element', 'stage', 'stages', 'treatment', 'treatments', 'reference', 'condition', 'player', 'introExitStep', or 'introExitSteps'.",
      });

      return;
    } else if (data.contentType === "other") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "contentType 'other' cannot be validated. Only use when custom content is required that does not match any of the other defined content types. Please use at your own discretion.",
      });
      return;
    }

    const result = matchContentType(data.contentType).safeParse(
      data.templateContent
    );
    if (!result.success) {
      result.error.issues.forEach((issue) =>
        ctx.addIssue({
          ...issue,
          path: ["templateContent", ...issue.path],
          message: `Invalid template content for content type '${data.contentType}': ${issue.message}`,
        })
      );
    }
  });

export function matchContentType(
  contentType: string
) {
  switch (contentType) {
    case "introSequence":
      return introSequenceSchema;
    case "introSequences":
      return introSequencesSchema;
    case "elements":
      return elementsSchema;
    case "element":
      return elementSchema;
    case "stage":
      return stageSchema;
    case "stages":
      return stagesSchema;
    case "treatment":
      return treatmentSchema;
    case "treatments":
      return treatmentsSchema;
    case "reference":
      return referenceSchema;
    case "condition":
      return conditionSchema;
    case "player":
      return playerSchema;
    case "introExitStep":
      return introExitStepSchema;
    case "introExitSteps":
      return introExitStepsSchema;
    default:
      throw new Error(`Unknown content type: ${contentType}`);
  }
}

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
