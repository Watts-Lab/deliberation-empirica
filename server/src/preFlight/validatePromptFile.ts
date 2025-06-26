import { z, ZodIssue } from "zod";

// This schema is used to ensure that the metadata conforms to the expected structure and types.
// Cannot be combined with the refine schema, if conditions within z.object fail, superRefine conditions will not be checked.
// We want all of the condtions to be checked simultaneously, so we use a separate refine schema.
export const metadataTypeSchema = z.object({
        name: z.string(),
        type: z.enum(["openResponse", "multipleChoice", "noResponse", "listSorter"]),
        notes: z.string().optional(),
        rows: z.number().int().min(1).optional(),
        shuffleOptions: z.boolean().optional(),
        select: z.enum(["single" , "multiple", "undefined"]).optional(),
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