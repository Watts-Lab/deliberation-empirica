"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchConfigSchema = void 0;
exports.validateBatchConfig = validateBatchConfig;
const zod_1 = require("zod");
exports.batchConfigSchema = zod_1.z
    .object({
    batchName: zod_1.z.string(),
    cdn: zod_1.z.enum(["test", "prod", "local"]),
    treatmentFile: zod_1.z.string().regex(/\.yaml$/),
    // introSequence: z.literal("none").or(z.string()),
    introSequence: zod_1.z.string().or(zod_1.z.literal("none", {
        message: `If you do not wish to use an intro sequence, enter value "none"`,
    })),
    treatments: zod_1.z.array(zod_1.z.string()).nonempty(),
    payoffs: zod_1.z
        .array(zod_1.z.number().positive())
        .nonempty()
        .or(zod_1.z.literal("equal", {
        message: `If you do not wish to define different payoffs for each treatment, enter value "equal"`,
    })),
    knockdowns: zod_1.z
        .union([
        zod_1.z.number().gt(0).lte(1),
        zod_1.z.array(zod_1.z.number().gt(0).lte(1)).nonempty(),
        zod_1.z.array(zod_1.z.array(zod_1.z.number().gt(0).lte(1)).nonempty()).nonempty(),
    ])
        .or(zod_1.z.literal("none", {
        message: `If you do not wish to use payoff knockdowns, enter value "none"`,
    })),
    exitCodes: zod_1.z
        .object({
        complete: zod_1.z.string(),
        error: zod_1.z.string(),
        lobbyTimeout: zod_1.z.string(),
    })
        .or(zod_1.z.literal("none", {
        message: `If you do not wish to supply exit codes, enter value "none"`,
    })),
    launchDate: zod_1.z
        .string()
        .transform((str) => new Date(str))
        .refine((date) => date > new Date(), {
        message: `Launch date must be in the future. If you do not wish to use a launch date, enter value "immediate"`,
    })
        .or(zod_1.z.literal("immediate", {
        message: `If you do not wish to use a launch date, enter value "immediate"`,
    })),
    customIdInstructions: zod_1.z
        .string()
        .refine((value) => value.endsWith(".md"), {
        message: 'Custom ID instructions should be implemented as a markdown file, ending with ".md"',
    })
        .or(zod_1.z.literal("none", {
        message: `If you do not wish to provide custom ID instructions, enter value "none"`,
    })),
    platformConsent: zod_1.z.enum(["US", "EU", "UK"]),
    consentAddendum: zod_1.z.string().or(zod_1.z.literal("none", {
        message: `If you do not wish to use an additional consent addendum, enter value "none"`,
    })),
    dispatchWait: zod_1.z.number().positive(),
    videoStorage: zod_1.z
        .object({
        bucket: zod_1.z.string(),
        region: zod_1.z.enum([
            "af-south-1",
            "ap-east-1",
            "ap-northeast-1",
            "ap-northeast-2",
            "ap-northeast-3",
            "ap-south-1",
            "ap-south-2",
            "ap-southeast-1",
            "ap-southeast-2",
            "ap-southeast-3",
            "ap-southeast-4",
            "ca-central-1",
            "ca-west-1",
            "eu-central-1",
            "eu-central-2",
            "eu-north-1",
            "eu-south-1",
            "eu-south-2",
            "eu-west-1",
            "eu-west-2",
            "eu-west-3",
            "il-central-1",
            "me-central-1",
            "me-south-1",
            "sa-east-1",
            "us-east-1",
            "us-east-2",
            "us-west-1",
            "us-west-2",
        ]),
    })
        .or(zod_1.z.literal("none", {
        message: `If you do not wish to store video, enter value "none"`,
    })),
    preregRepos: zod_1.z.array(zod_1.z.object({
        owner: zod_1.z.string(),
        repo: zod_1.z.string(),
        branch: zod_1.z.string(),
        directory: zod_1.z.string(),
    }), {
        message: `If you do not wish to specify a separate preregistration repository, enter an empty array "[]"`,
    }),
    dataRepos: zod_1.z.array(zod_1.z.object({
        owner: zod_1.z.string(),
        repo: zod_1.z.string(),
        branch: zod_1.z.string(),
        directory: zod_1.z.string(),
    })),
    centralPrereg: zod_1.z.boolean({
        message: `Must be a boolean. If you do not wish to preregister to the central repository, enter "false"`,
    }),
    checkAudio: zod_1.z.boolean({
        message: `Must be a boolean. If you do not wish to check participant audio, enter "false"`,
    }),
    checkVideo: zod_1.z.boolean({
        message: `Must be a boolean. If you do not wish to check participant video, enter "false"`,
    }),
})
    .strict()
    .superRefine((obj, ctx) => {
    // check that length of payoffs matches length of treatments
    if (obj.payoffs !== "equal" &&
        obj.treatments.length !== obj.payoffs.length) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: `Number of payoffs must match number of treatments, or be set to "equal"`,
            path: ["payoffs"],
        });
    }
    if (obj.checkVideo && !obj.checkAudio) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: `Cannot check video without also checking audio`,
            path: ["checkAudio"],
        });
    }
    if (obj.knockdowns !== "none") {
        if (Array.isArray(obj.knockdowns)) {
            // if any row is an array, all rows must be arrays
            const isMatrix = !obj.knockdowns.every((row) => !Array.isArray(row));
            if (isMatrix) {
                if (obj.knockdowns.length !== obj.treatments.length) {
                    ctx.addIssue({
                        code: zod_1.z.ZodIssueCode.custom,
                        message: `Number of rows in knockdown matrix must match number of treatments`,
                        path: ["knockdowns"],
                    });
                }
                obj.knockdowns.forEach((row, index) => {
                    // check that all rows have same length as treatments
                    if (!Array.isArray(row) || row.length !== obj.treatments.length) {
                        ctx.addIssue({
                            code: zod_1.z.ZodIssueCode.custom,
                            message: `Knockdown matrix row ${index} must match number of treatments`,
                            path: ["knockdowns"],
                        });
                    }
                });
            }
            else {
                if (obj.knockdowns.length !== obj.treatments.length) {
                    ctx.addIssue({
                        code: zod_1.z.ZodIssueCode.custom,
                        message: `Number of knockdowns must match number of treatments`,
                        path: ["knockdowns"],
                    });
                }
            }
        }
    }
});
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ValidationError";
    }
}
function validateBatchConfig(config) {
    const result = exports.batchConfigSchema.safeParse(config);
    if (!result.success) {
        const errors = result.error.format();
        const generalErrors = errors["_errors"];
        const keyErrors = Object.keys(errors).map((key, index) => { var _a; return key[0] !== "_" ? `${key}: ${(_a = errors[key]["_errors"]) === null || _a === void 0 ? void 0 : _a.join(" - ")}` : ""; });
        throw new ValidationError(`Problem(s) in batch config:\n- ${[...generalErrors, ...keyErrors].join("\n- ")}`);
    }
    return result.data;
}
