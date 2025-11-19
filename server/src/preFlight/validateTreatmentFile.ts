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

export const showToPositionsSchema = z
  .array(positionSchema, {
    required_error:
      "Expected an array for `showToPositions`. Make sure each item starts with a dash (`-`) in YAML.",
    invalid_type_error:
      "Expected an array for `showToPositions`. Make sure each item starts with a dash (`-`) in YAML.",
  })
  .nonempty(); // TODO: check for unique values (or coerce to unique values)
export type ShowToPositionsType = z.infer<typeof showToPositionsSchema>;

export const hideFromPositionsSchema = z
  .array(positionSchema, {
    required_error:
      "Expected an array for `hideFromPositions`. Make sure each item starts with a dash (`-`) in YAML.",
    invalid_type_error:
      "Expected an array for `hideFromPositions`. Make sure each item starts with a dash (`-`) in YAML.",
  })
  .nonempty(); // TODO: check for unique values (or coerce to unique values)
export type HideFromPositionsType = z.infer<typeof hideFromPositionsSchema>;

const displayRegionRangeSchema = z
  .object({
    first: z.number().int().nonnegative(),
    last: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.last < value.first) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "`last` must be greater than or equal to `first`.",
      });
    }
  });

const displayRegionAxisSchema = z.union([
  z.number().int().nonnegative(),
  displayRegionRangeSchema,
]);

export const displayRegionSchema = z
  .object({
    rows: displayRegionAxisSchema,
    cols: displayRegionAxisSchema,
  })
  .strict();
export type DisplayRegionType = z.infer<typeof displayRegionSchema>;

const feedMediaSchema = z
  .object({
    audio: z.boolean().optional(),
    video: z.boolean().optional(),
    screen: z.boolean().optional(),
  })
  .strict();

const participantSourceSchema = z
  .object({
    type: z.literal("participant"),
    position: positionSchema,
  })
  .strict();

const selfSourceSchema = z
  .object({
    type: z.literal("self"),
  })
  .strict();

const otherSourceSchema = z
  .object({
    type: z
      .string()
      .min(1)
      .refine(
        (value) => value !== "participant" && value !== "self",
        "Provide additional data using a different source type."
      ),
    position: z.union([positionSchema, z.string()]).optional(),
  })
  .strict();

const feedSourceSchema = z.union([
  participantSourceSchema,
  selfSourceSchema,
  otherSourceSchema,
]);

const renderHintSchema = z.union([
  z.literal("auto"),
  z.literal("tile"),
  z.literal("audioOnlyBadge"),
  z.literal("hidden"),
  z.string().min(1),
]);

const feedOptionsSchema = z.record(z.string(), z.unknown());

const layoutFeedSchema = z
  .object({
    source: feedSourceSchema,
    media: feedMediaSchema.optional(),
    displayRegion: displayRegionSchema,
    zOrder: z.number().int().optional(),
    render: renderHintSchema.optional(),
    label: z.string().optional(),
    options: feedOptionsSchema.optional(),
  })
  .strict();

const layoutFeedDefaultsSchema = z
  .object({
    media: feedMediaSchema.optional(),
    zOrder: z.number().int().optional(),
    render: renderHintSchema.optional(),
    label: z.string().optional(),
    options: feedOptionsSchema.optional(),
  })
  .strict();

const layoutGridOptionsSchema = z
  .object({
    gap: z.number().nonnegative().optional(),
    background: z.string().optional(),
  })
  .strict();

const layoutGridSchema = z
  .object({
    rows: z.number().int().positive(),
    cols: z.number().int().positive(),
    options: layoutGridOptionsSchema.optional(),
  })
  .strict();

const layoutDefinitionSchema = z
  .object({
    grid: layoutGridSchema,
    feeds: z.array(layoutFeedSchema).nonempty(),
    defaults: layoutFeedDefaultsSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const gridRows = value.grid.rows;
    const gridCols = value.grid.cols;

    value.feeds.forEach((feed, feedIndex) => {
      const rows =
        typeof feed.displayRegion.rows === "number"
          ? { first: feed.displayRegion.rows, last: feed.displayRegion.rows }
          : feed.displayRegion.rows;
      const cols =
        typeof feed.displayRegion.cols === "number"
          ? { first: feed.displayRegion.cols, last: feed.displayRegion.cols }
          : feed.displayRegion.cols;

      if (rows.first >= gridRows || rows.last >= gridRows) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["feeds", feedIndex, "displayRegion", "rows"],
          message: "`rows` indices must be within the grid bounds.",
        });
      }

      if (cols.first >= gridCols || cols.last >= gridCols) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["feeds", feedIndex, "displayRegion", "cols"],
          message: "`cols` indices must be within the grid bounds.",
        });
      }
    });
  });

const layoutBySeatSchema = z
  .record(z.string(), layoutDefinitionSchema)
  .superRefine((value, ctx) => {
    Object.keys(value).forEach((key) => {
      const seat = Number(key);
      if (!Number.isInteger(seat) || seat < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "Layout keys must be zero-based nonnegative integers.",
        });
      }
    });
  });

const discussionRoomSchema = z
  .object({
    includePositions: z
      .array(positionSchema, {
        required_error:
          "Expected an array for `includePositions`. Make sure each item starts with a dash (`-`) in YAML.",
        invalid_type_error:
          "Expected an array for `includePositions`. Make sure each item starts with a dash (`-`) in YAML.",
      })
      .nonempty(),
  })
  .strict();

export const discussionSchema = z
  .object({
    chatType: z.enum(["text", "audio", "video"]),
    showNickname: z.boolean(),
    showTitle: z.boolean(),
    showSelfView: z.boolean().optional().default(true),
    reactionEmojisAvailable: z.array(z.string()).optional(),
    reactToSelf: z.boolean().optional(),
    numReactionsPerMessage: z.number().int().nonnegative().optional(),
    layout: layoutBySeatSchema.optional(),
    rooms: z.array(discussionRoomSchema).nonempty().optional(),
    // New: allow discussion-level position-based visibility controls
    showToPositions: showToPositionsSchema.optional(),
    hideFromPositions: hideFromPositionsSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    // Emoji reaction parameters should only be used with text chat
    if (data.chatType !== "text") {
      if (data.reactionEmojisAvailable !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reactionEmojisAvailable"],
          message:
            "reactionEmojisAvailable can only be used with chatType 'text'",
        });
      }
      if (data.reactToSelf !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reactToSelf"],
          message: "reactToSelf can only be used with chatType 'text'",
        });
      }
      if (data.numReactionsPerMessage !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["numReactionsPerMessage"],
          message:
            "numReactionsPerMessage can only be used with chatType 'text'",
        });
      }
    }

    if (data.layout !== undefined && data.chatType !== "video") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["layout"],
        message: "layout can only be used with chatType 'video'",
      });
    }

    if (data.rooms !== undefined && data.chatType !== "video") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rooms"],
        message: "rooms can only be used with chatType 'video'",
      });
    }
  });
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
        message:
          "Field key cannot be 'type', as it is reserved for element types.",
      });
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
      case "trackedLink":
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
  z
    .array(conditionSchema, {
      required_error:
        "Expected an array for `conditions`. Make sure each item starts with a dash (`-`) in YAML.",
      invalid_type_error:
        "Expected an array for `conditions`. Make sure each item starts with a dash (`-`) in YAML.",
    })
    .nonempty()
);
export type ConditionType = z.infer<typeof conditionSchema>;

// ------------------ Players ------------------ //

export const playerSchema = z
  .object({
    desc: descriptionSchema.optional(),
    position: positionSchema,
    title: z.string().max(25).optional(),
    conditions: z
      .array(conditionSchema, {
        invalid_type_error:
          "Expected an array for `conditions`. Make sure each item starts with a dash (`-`) in YAML.",
      })
      .optional(),
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
    tags: z
      .array(z.string(), {
        invalid_type_error:
          "Expected an array for `tags`. Make sure each item starts with a dash (`-`) in YAML.",
      })
      .optional(),
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
    params: z
      .array(z.record(z.string().or(z.number())), {
        invalid_type_error:
          "Expected an array for `params`. Make sure each item starts with a dash (`-`) in YAML.",
      })
      .optional(),
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

const trackedLinkParamSchema = z
  .object({
    key: z.string().min(1),
    value: z
      .union([z.string(), z.number(), z.boolean(), fieldPlaceholderSchema])
      .optional(),
    reference: referenceSchema.optional(),
    position: positionSelectorSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.value !== undefined && data.reference !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either `value` or `reference`, not both.",
        path: ["value"],
      });
    }
  });

// Element for instrumented external links (see client/src/elements/TrackedLink.jsx).
// We validate the static fields plus the structured urlParams array so that Typos get caught at preflight.
const trackedLinkSchema = elementBaseSchema
  .extend({
    type: z.literal("trackedLink"),
    name: nameSchema,
    url: urlSchema,
    displayText: z.string().min(1),
    urlParams: z
      .array(trackedLinkParamSchema, {
        invalid_type_error:
          "Expected an array for `urlParams`. Make sure each item starts with a dash (`-`) in YAML.",
      })
      .optional(),
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
  "trackedLink",
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
          trackedLinkSchema,
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
  z
    .array(elementSchema, {
      required_error:
        "Expected an array for `elements`. Make sure each item starts with a dash (`-`) in YAML.",
      invalid_type_error:
        "Expected an array for `elements`. Make sure each item starts with a dash (`-`) in YAML.",
    })
    .nonempty()
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
        });
      }
    })
);
export type StageType = z.infer<typeof stageSchema>;

const stagesSchema = altTemplateContext(
  z
    .array(stageSchema, {
      required_error:
        "Expected an array for `stages`. Make sure each item starts with a dash (`-`) in YAML.",
      invalid_type_error:
        "Expected an array for `stages`. Make sure each item starts with a dash (`-`) in YAML.",
    })
    .nonempty()
);

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

export const introExitStepsBaseSchema = altTemplateContext(
  z
    .array(introExitStepSchema, {
      required_error:
        "Expected an array for `introSteps`. Make sure each item starts with a dash (`-`) in YAML.",
      invalid_type_error:
        "Expected an array for `introSteps`. Make sure each item starts with a dash (`-`) in YAML.",
    })
    .nonempty()
);

// Backwards compatibility export for downstream packages still referencing the legacy name.
export const introExitStepsSchema = introExitStepsBaseSchema;

export const introStepsSchema = introExitStepsBaseSchema.superRefine(
  (data, ctx) => {
    data?.forEach((step: IntroExitStepType, stepIdx: number) => {
      if (Array.isArray(step.elements)) {
        step.elements.forEach((element: ElementType, elementIdx: number) => {
          if (
            element &&
            typeof element === "object" &&
            "shared" in element &&
            element.shared
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [stepIdx, "elements", elementIdx, "shared"],
              message: `Prompt element in intro/exit steps cannot be shared.`,
            });
          }
          if ("position" in element) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [stepIdx, "elements", elementIdx, "position"],
              message: `Elements in intro steps cannot have a 'position' field.`,
            });
          }
          if ("showToPositions" in element) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [stepIdx, "elements", elementIdx],
              message: `Elements in intro steps cannot have a 'showToPositions' field.`,
            });
          }
          if ("hideFromPositions" in element) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [stepIdx, "elements", elementIdx],
              message: `Elements in intro steps cannot have a 'hideFromPositions' field.`,
            });
          }
        });
      }
    });
  }
);

export const exitStepsSchema = introExitStepsBaseSchema.superRefine(
  (data, ctx) => {
    data?.forEach((step: IntroExitStepType, stepIdx: number) => {
      if (Array.isArray(step.elements)) {
        step.elements.forEach((element: ElementType, elementIdx: number) => {
          if (
            element &&
            typeof element === "object" &&
            "shared" in element &&
            element.shared
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [stepIdx, "elements", elementIdx, "shared"],
              message: `Prompt element in intro/exit steps cannot be shared.`,
            });
          }
        });
      }
    });
  }
);

// ------------------ Intro Sequences and Treatments ------------------ //
export const introSequenceSchema = altTemplateContext(
  z
    .object({
      name: nameSchema,
      desc: descriptionSchema.optional(),
      introSteps: introStepsSchema,
    })
    .strict()
);
export type IntroSequenceType = z.infer<typeof introSequenceSchema>;

export const introSequencesSchema = altTemplateContext(
  z
    .array(introSequenceSchema, {
      required_error:
        "Expected an array for `introSequence`. Make sure each item starts with a dash (`-`) in YAML.",
      invalid_type_error:
        "Expected an array for `introSequence`. Make sure each item starts with a dash (`-`) in YAML.",
    })
    .nonempty()
);

export const baseTreatmentSchema = z
  .object({
    name: nameSchema,
    desc: descriptionSchema.optional(),
    playerCount: z.number(),
    groupComposition: z
      .array(playerSchema, {
        invalid_type_error:
          "Expected an array for `groupComposition`. Make sure each item starts with a dash (`-`) in YAML.",
      })
      .optional(),
    gameStages: stagesSchema,
    exitSequence: exitStepsSchema.optional(),
  })
  .strict();

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
        if (
          typeof player.position === "number" &&
          player.position >= playerCount
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["groupComposition", index, "position"],
            message: `Player position index ${player.position} in groupComposition exceeds playerCount of ${playerCount}.`,
          });
        }
      });
      if (groupComposition) {
        const positions = groupComposition
          .map((player) => player.position)
          .filter((pos) => typeof pos === "number");
        const uniquePositions = new Set(positions);
        if (uniquePositions.size !== positions.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["groupComposition"],
            message: `Player positions in groupComposition must be unique.`,
          });
        }
        const expectedPositions = Array.from({ length: playerCount }, (_, i) => i);
        const missingPositions = expectedPositions.filter((pos) => !uniquePositions.has(pos));
        if (missingPositions.length > 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["groupComposition"],
            message: `Player positions in groupComposition must include all nonnegative integers below playerCount (${playerCount}). Missing: ${missingPositions.join(", ")}.`,
          });
        }
      }
      gameStages?.forEach(
        (
          stage: { elements: any[]; name: any; discussion?: any },
          stageIndex: string | number
        ) => {
          stage?.elements?.forEach(
            (element: any, elementIndex: string | number) => {
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
            }
          );

          const discussion = stage?.discussion as any;
          if (discussion) {
            ["showToPositions", "hideFromPositions"].forEach((key) => {
              const positions = discussion?.[key];
              if (Array.isArray(positions)) {
                positions.forEach((pos, posIndex) => {
                  if (typeof pos === "number" && pos >= playerCount) {
                    ctx.addIssue({
                      code: z.ZodIssueCode.custom,
                      path: [
                        "gameStages",
                        stageIndex,
                        "discussion",
                        key,
                        posIndex,
                      ],
                      message: `${key} index ${pos} in discussion of stage "${stage.name}" exceeds playerCount of ${playerCount}.`,
                    });
                  }
                });
              }
            });

            const { rooms, showToPositions, hideFromPositions } = discussion || {};
            if (Array.isArray(rooms) && rooms.length > 0) {
              const allPositions: number[] = Array.from(
                { length: playerCount },
                (_, i) => i
              );
              let candidatePositions = allPositions;
              if (Array.isArray(showToPositions) && showToPositions.length > 0) {
                candidatePositions = candidatePositions.filter((p) =>
                  showToPositions.includes(p)
                );
              }
              if (Array.isArray(hideFromPositions) && hideFromPositions.length > 0) {
                candidatePositions = candidatePositions.filter(
                  (p) => !hideFromPositions.includes(p)
                );
              }

              const assigned = new Set<number>();
              rooms.forEach((room: any, roomIndex: number) => {
                const inc = room?.includePositions;
                if (Array.isArray(inc)) {
                  inc.forEach((pos: any, posIndex: number) => {
                    if (typeof pos === "number") {
                      assigned.add(pos);
                      if (pos >= playerCount) {
                        ctx.addIssue({
                          code: z.ZodIssueCode.custom,
                          path: [
                            "gameStages",
                            stageIndex,
                            "discussion",
                            "rooms",
                            roomIndex,
                            "includePositions",
                            posIndex,
                          ],
                          message: `includePositions index ${pos} in discussion room exceeds playerCount of ${playerCount}.`,
                        });
                      }
                    }
                  });
                }
              });

              const missing = candidatePositions.filter((p) => !assigned.has(p));
              if (missing.length > 0) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  path: ["gameStages", stageIndex, "discussion", "rooms"],
                  message: `Rooms defined but the following visible player positions are not assigned to any room: ${missing.join(
                    ", "
                  )}. Each visible position (respecting showToPositions/hideFromPositions) must appear in one includePositions array.`,
                });
              }
            }
          }
        }
      );
    })
);

export type TreatmentType = z.infer<typeof treatmentSchema>;

export const treatmentsSchema = altTemplateContext(
  z
    .array(treatmentSchema, {
      required_error:
        "Expected an array for `treatments`. Make sure each item starts with a dash (`-`) in YAML.",
      invalid_type_error:
        "Expected an array for `treatments`. Make sure each item starts with a dash (`-`) in YAML.",
    })
    .nonempty()
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
    // specify intro step or exit step, not both
    { schema: introExitStepSchema, name: "Intro Exit Step" },
    { schema: exitStepsSchema, name: "Exit Steps" },
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
          issue.message ===
            "promptShorthandSchema expects a string, but received object."
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
    contentType: z
      .enum([
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
        "exitSteps",
        "other",
      ])
      .optional(),
    templateDesc: descriptionSchema.optional(),
    templateContent: z.any(),
  })
  .strict()
  .superRefine((data, ctx) => {
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
          "contentType field is required. Please specify a valid content type. Valid content types are 'introSequence', 'introSequences', 'elements', 'element', 'stage', 'stages', 'treatment', 'treatments', 'reference', 'condition', 'player', 'introExitStep', or 'exitSteps'.",
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

export function matchContentType(contentType: string) {
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
    case "exitSteps":
      return exitStepsSchema;
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
