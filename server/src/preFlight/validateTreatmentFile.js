"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.treatmentSchema = exports.playerSchema = exports.existStepSchema = exports.stageSchema = exports.elementsSchema = exports.submitButtonSchema = exports.sharedNotepadSchema = exports.separatorSchema = exports.qualtricsSchema = exports.promptShorthandSchema = exports.promptSchema = exports.displaySchema = exports.audioSchema = exports.elementSchema = exports.discussionSchema = exports.hideFromPositionsSchema = exports.showToPositionsSchema = exports.positionSelectorSchema = exports.positionSchema = exports.hideTimeSchema = exports.displayTimeSchema = exports.descriptionSchema = exports.durationSchema = exports.nameSchema = exports.urlSchema = exports.fileSchema = exports.conditionSchema = exports.introConditionSchema = exports.referenceSchema = void 0;
const zod_1 = require("zod");
function isValidRegex(pattern) {
    try {
        new RegExp(pattern);
        return true;
    }
    catch (e) {
        if (e instanceof SyntaxError) {
            return false;
        }
        throw e;
    }
}
exports.referenceSchema = zod_1.z
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
                    code: zod_1.z.ZodIssueCode.custom,
                    message: `A path must be provided, e.g. '${givenType}.${name}.object.selectors.here'`,
                    path: ["path"],
                });
            }
            if (name === undefined || name.length < 1) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    message: `A name must be provided, e.g. '${givenType}.elementName.object.selectors.here'`,
                    path: ["name"],
                });
            }
            break;
        case "prompt":
            [, name] = arr;
            if (name === undefined || name.length < 1) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
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
                    code: zod_1.z.ZodIssueCode.custom,
                    message: `A path must be provided, e.g. '${givenType}.object.selectors.here.`,
                    path: ["path"],
                });
            }
            break;
        default:
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: `Invalid reference type "${givenType}"`,
                path: ["type"],
            });
    }
});
const refineCondition = (obj, ctx) => {
    const { comparator, value } = obj;
    if (!["exists", "doesNotExist"].includes(comparator) && value === undefined) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: `Value is required for '${comparator}'`,
            path: ["value"],
        });
    }
    if (["isOneOf", "isNotOneOf"].includes(comparator) && !Array.isArray(value)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.invalid_type,
            expected: "array",
            received: typeof value,
            message: `Value must be an array for '${comparator}'`,
            path: ["value"],
        });
    }
    if ([
        "hasLengthAtLeast",
        "hasLengthAtMost",
        "isAbove",
        "isBelow",
        "isAtLeast",
        "isAtMost",
    ].includes(comparator) &&
        typeof value !== "number") {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.invalid_type,
            expected: "number",
            received: typeof value,
            message: `Value must be a number for '${comparator}'`,
            path: ["value"],
        });
    }
    if (["hasLengthAtLeast", "hasLengthAtMost"].includes(comparator) &&
        typeof value == "number" &&
        value < 0) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.too_small,
            type: "number",
            minimum: 0,
            inclusive: false,
            message: `Value must be a positive number for '${comparator}'`,
            path: ["value"],
        });
    }
    if (["includes", "doesNotInclude"].includes(comparator) &&
        typeof value !== "string") {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.invalid_type,
            expected: "string",
            received: typeof value,
            message: `Value must be a string for '${comparator}'`,
            path: ["value"],
        });
    }
    if (["matches", "doesNotMatch"].includes(comparator) &&
        (typeof value !== "string" || !isValidRegex(value))) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: `Value must be a valid regex expression for '${comparator}'`,
            path: ["value"],
        });
    }
};
const baseConditionSchema = zod_1.z
    .object({
    reference: exports.referenceSchema,
    comparator: zod_1.z.enum([
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
    value: zod_1.z
        .number()
        .or(zod_1.z.string())
        .or(zod_1.z.array(zod_1.z.string().or(zod_1.z.number())))
        .optional(),
})
    .strict();
exports.introConditionSchema = baseConditionSchema.superRefine(refineCondition);
exports.conditionSchema = baseConditionSchema
    .extend({
    position: zod_1.z
        .enum(["shared", "player", "all"])
        .or(zod_1.z.number().nonnegative().int())
        .default("player"),
})
    .superRefine(refineCondition);
// export const introSequenceSchema = z.object({});
// Do we have a separate type schema? or do we include it in the individual element types?
// maybe just make it a dropdown in the researcher portal
const typeSchema = zod_1.z.string().min(1, "Type is required");
// --------------- Little Schemas --------------- //
// can be used in form validation
// TODO: check that file exists
exports.fileSchema = zod_1.z.string().optional();
// TODO: check that url is a valid url
exports.urlSchema = zod_1.z.string().url();
// Names should have properties:
// max length: 64 characters
// min length: 1 character
// allowed characters: a-z, A-Z, 0-9, -, _, and space
exports.nameSchema = zod_1.z
    .string()
    .min(1, "Name is required")
    .max(64)
    .regex(/^[a-zA-Z0-9-_ ]+$/);
// stage duration:
// min: 1 second
// max: 1 hour
exports.durationSchema = zod_1.z
    .number()
    .int()
    .positive()
    .max(3600, "Duration must be less than 3600 seconds");
// Description is optional
exports.descriptionSchema = zod_1.z.string();
//display time should have these properties:
// min: 1 sec
// max: 1 hour
exports.displayTimeSchema = zod_1.z
    .number()
    .int()
    .positive()
    .max(3600, "Duration must be less than 1 hour");
// hideTime should have these properties:
// min: 1 sec
// max: 1 hour
exports.hideTimeSchema = zod_1.z
    .number()
    .int()
    .positive()
    .max(3600, "Duration must be less than 1 hour");
exports.positionSchema = zod_1.z.number().int().positive();
exports.positionSelectorSchema = zod_1.z
    .enum(["shared", "player", "all"])
    .or(exports.positionSchema)
    .default("player");
// showToPositions is a list of nonnegative integers
// and are unique
exports.showToPositionsSchema = zod_1.z.array(exports.positionSchema).nonempty(); // TODO: check for unique values (or coerce to unique values)
// .unique();
// hideFromPositions is a list of nonnegative integers
// and are unique
exports.hideFromPositionsSchema = zod_1.z.array(exports.positionSchema).nonempty(); // TODO: check for unique values (or coerce to unique values)
// .unique();
exports.discussionSchema = zod_1.z.object({
    chatType: zod_1.z.enum(["text", "audio", "video"]),
    showNickname: zod_1.z.boolean(),
    showTitle: zod_1.z.boolean(),
});
// ------------------ Elements ------------------ //
exports.elementSchema = zod_1.z
    .object({
    name: exports.nameSchema.optional(),
    desc: exports.descriptionSchema.optional(),
    displayTime: exports.displayTimeSchema.optional(),
    hideTime: exports.hideTimeSchema.optional(),
    showToPositions: exports.showToPositionsSchema.optional(),
    hideFromPositions: exports.hideFromPositionsSchema.optional(),
    conditions: zod_1.z.array(exports.conditionSchema).optional(),
})
    .strict();
exports.audioSchema = exports.elementSchema.extend({
    type: zod_1.z.literal("audio"),
    file: exports.fileSchema,
    // Todo: check that file exists
});
exports.displaySchema = exports.elementSchema.extend({
    type: zod_1.z.literal("display"),
    reference: exports.referenceSchema,
    position: exports.positionSelectorSchema,
});
exports.promptSchema = exports.elementSchema.extend({
    type: zod_1.z.literal("prompt"),
    file: exports.fileSchema,
    shared: zod_1.z.boolean().optional(),
});
exports.promptShorthandSchema = exports.fileSchema.transform((str) => {
    const newElement = {
        type: "prompt",
        file: str,
    };
    return newElement;
});
exports.qualtricsSchema = exports.elementSchema.extend({
    type: zod_1.z.literal("qualtrics"),
    url: exports.urlSchema,
    params: zod_1.z.array(zod_1.z.record(zod_1.z.string().or(zod_1.z.number()))).optional(),
});
exports.separatorSchema = exports.elementSchema.extend({
    type: zod_1.z.literal("separator"),
    style: zod_1.z.enum(["thin", "thick", "regular"]).optional(),
});
exports.sharedNotepadSchema = exports.elementSchema.extend({
    type: zod_1.z.literal("sharedNotepad"),
});
exports.submitButtonSchema = exports.elementSchema.extend({
    type: zod_1.z.literal("submitButton"),
    buttonText: zod_1.z.string().max(32).optional(),
});
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
exports.elementsSchema = zod_1.z
    .array(zod_1.z.discriminatedUnion("type", [
    exports.audioSchema,
    // displaySchema,
    exports.promptSchema,
    // qualtricsSchema,
    // separatorSchema,
    // sharedNotepadSchema,
    // submitButtonSchema,
    // surveySchema,
    // talkMeterSchema,
    // timerSchema,
    // videoSchema,
])
// .or(promptShorthandSchema)
)
    .nonempty();
exports.stageSchema = zod_1.z
    .object({
    name: exports.nameSchema,
    desc: exports.descriptionSchema.optional(),
    discussion: exports.discussionSchema.optional(),
    duration: exports.durationSchema,
    elements: exports.elementsSchema,
})
    .strict();
exports.existStepSchema = zod_1.z
    .object({
    name: exports.nameSchema,
    desc: exports.descriptionSchema.optional(),
    elements: exports.elementsSchema,
})
    .strict();
exports.playerSchema = zod_1.z
    .object({
    desc: exports.descriptionSchema.optional(),
    position: exports.positionSchema,
    title: zod_1.z.string().max(25).optional(),
    conditions: zod_1.z.array(exports.conditionSchema).optional(),
})
    .strict();
exports.treatmentSchema = zod_1.z
    .object({
    name: exports.nameSchema,
    desc: exports.descriptionSchema.optional(),
    playerCount: zod_1.z.number(),
    groupComposition: zod_1.z.array(exports.playerSchema).optional(),
    gameStages: zod_1.z.array(exports.stageSchema),
    exitSequence: zod_1.z.array(exports.existStepSchema).nonempty().optional(),
})
    .strict();
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
