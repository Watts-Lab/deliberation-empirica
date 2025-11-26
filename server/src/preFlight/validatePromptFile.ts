import { z, ZodIssue } from "zod";

// This schema is used to ensure that the metadata conforms to the expected structure and types.
// Cannot be combined with the refine schema, if conditions within z.object fail, superRefine conditions will not be checked.
// We want all of the condtions to be checked simultaneously, so we use a separate refine schema.
export const metadataTypeSchema = z.object({
        name: z.string(),
        type: z.enum(["openResponse", "multipleChoice", "noResponse", "listSorter", "slider"]),
        notes: z.string().optional(),
        rows: z.number().int().min(1).optional(),
        shuffleOptions: z.boolean().optional(),
        select: z.enum(["single" , "multiple", "undefined"]).optional(),
        minLength: z.number().int().min(0).optional(),
        maxLength: z.number().int().min(1).optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        interval: z.number().optional(),
        labelPts: z.array(z.number()).optional(),
    });

// Refined schema that adds additional validation rules based on the type of prompt
// This schema checks that certain fields are only present for specific types of prompts.
// Conditions in z.object will always pass as long as the extension detects the file,
// so we are guarenteed to always check against superRefine conditions.
export const metadataRefineSchema = z.object({
        name: z.any(),
        type: z.any(),
        notes: z.any().optional(),
        rows: z.any().optional(),
        shuffleOptions: z.any().optional(),
        select: z.any().optional(),
        minLength: z.any().optional(),
        maxLength: z.any().optional(),
        min: z.any().optional(),
        max: z.any().optional(),
        interval: z.any().optional(),
        labelPts: z.any().optional(),
    }).superRefine((data, ctx) => {
        if (data.type !== "openResponse" && data.rows !== undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `rows can only be specified for openResponse type`,
                path : ["rows"],
            });
        }
        if (data.type !== "multipleChoice" && data.select !== undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `select can only be specified for multipleChoice type`,
                path : ["select"],
            });
        }
        if (data.type === "noResponse" && data.shuffleOptions !== undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `shuffleOptions cannot be specified for noResponse type`,
                path : ["shuffleOptions"],
            });
        }
        if (data.type !== "openResponse" && data.minLength !== undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `minLength can only be specified for openResponse type`,
                path : ["minLength"],
            });
        }
        if (data.type !== "openResponse" && data.maxLength !== undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `maxLength can only be specified for openResponse type`,
                path : ["maxLength"],
            });
        }
        if (data.minLength !== undefined && data.maxLength !== undefined && data.minLength > data.maxLength) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `minLength cannot be greater than maxLength`,
                path : ["minLength"],
            });
        }
        // Slider-specific validation
        if (data.type === "slider") {
            if (data.min === undefined) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `min is required for slider type`,
                    path : ["min"],
                });
            }
            if (data.max === undefined) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `max is required for slider type`,
                    path : ["max"],
                });
            }
            if (data.interval === undefined) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `interval is required for slider type`,
                    path : ["interval"],
                });
            }
            if (data.min !== undefined && data.max !== undefined && data.min >= data.max) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `min must be less than max`,
                    path : ["min"],
                });
            }
            if (data.min !== undefined && data.max !== undefined && data.interval !== undefined && data.min + data.interval > data.max) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `min + interval must be less than or equal to max`,
                    path : ["interval"],
                });
            }
        }
        if (data.type !== "slider" && data.min !== undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `min can only be specified for slider type`,
                path : ["min"],
            });
        }
        if (data.type !== "slider" && data.max !== undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `max can only be specified for slider type`,
                path : ["max"],
            });
        }
        if (data.type !== "slider" && data.interval !== undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `interval can only be specified for slider type`,
                path : ["interval"],
            });
        }
        if (data.type !== "slider" && data.labelPts !== undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `labelPts can only be specified for slider type`,
                path : ["labelPts"],
            });
        }
    });

// Function to validate that the metadata name matches the file name
// Need to separate this from the refine schema because since it is a function, type cannot be inferred
export const metadataLogicalSchema = (fileName: string) =>
    metadataRefineSchema.superRefine((data, ctx) => {
        if (data.name !== fileName) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `name must match file path starting from repository root`,
                path : ["name"],
            });
        }
    });

export type MetadataType = z.infer<typeof metadataTypeSchema>;
export type MetadataRefineType = z.infer<typeof metadataRefineSchema>;

// Function to validate that labelPts length matches the number of response items for slider type
export const validateSliderLabels = (metadata: any, responseItems: string[]): ZodIssue[] => {
    const issues: ZodIssue[] = [];
    
    if (metadata.type === "slider" && metadata.labelPts !== undefined) {
        if (metadata.labelPts.length !== responseItems.length) {
            issues.push({
                code: z.ZodIssueCode.custom,
                message: `labelPts length (${metadata.labelPts.length}) must match the number of labels (${responseItems.length})`,
                path: ["labelPts"],
            });
        }
    }
    
    return issues;
};