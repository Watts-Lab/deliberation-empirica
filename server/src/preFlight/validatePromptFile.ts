import { z, ZodIssue } from "zod";

export const metadataBaseSchema = z.object({
        name: z.string(),
        type: z.enum(["openResponse", "multipleChoice", "noResponse", "listSorter"]),
    });

export const metadataSchema = (fileName: string) =>
    metadataBaseSchema.superRefine((data, ctx) => {
        if (data.name !== fileName) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `name must match file path starting from repository root`,
                path : ["name"],
            });
        }
    });

export const metadataNotesSchema = z.object({
        name: z.any(),
        type: z.any(),
        notes: z.string().optional(),
    });

export const metadataRowSchema = z.object({
        name: z.any(),
        type: z.any(),
        rows: z.any().optional(),
    }).superRefine((data, ctx) => {
         if (data.type !== "openResponse" && data.rows !== undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `rows can only be specified for openResponse type`,
                path : ["rows"],
            });
        }
    });


export const metadataRowSecondSchema = z.object({
        name: z.any(),
        type: z.any(),
        rows: z.number().int().min(1).optional(),
    });

export const metadataShuffleSchema = z.object({
        name: z.any(),
        type: z.any(),
        shuffleOptions: z.any().optional(),
    }).superRefine((data, ctx) => {
        if (data.type === "noResponse" && data.shuffleOptions !== undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `shuffleOptions cannot be specified for noResponse type`,
                path : ["shuffleOptions"],
            });
        }
    });

export const metadataShuffleSecondSchema = z.object({
        name: z.any(),
        type: z.any(),
        shuffleOptions: z.boolean().optional(),
    });

export const metadataSelectSchema = z.object({
        name: z.any(),
        type: z.any(),
        select: z.any().optional(),
    }).superRefine((data, ctx) => {
        if (data.type !== "multipleChoice" && data.select !== undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `select can only be specified for multipleChoice type`,
                path : ["select"],
            });
        }
    });

export const metadataSelectSecondSchema = z.object({
        name: z.any(),
        type: z.any(),
        select: z.enum(["single" , "multiple", "undefined"]).optional(),
    });


export type MetadataBaseType = z.infer<typeof metadataBaseSchema>;
export type MetadataNotesType = z.infer<typeof metadataNotesSchema>;
export type MetadataRowType = z.infer<typeof metadataRowSchema>;
export type MetadataRowSecondType = z.infer<typeof metadataRowSecondSchema>;
export type MetadataShuffleType = z.infer<typeof metadataShuffleSchema>;
export type MetadataShuffleSecondType = z.infer<typeof metadataShuffleSecondSchema>;
export type MetadataSelectType = z.infer<typeof metadataSelectSchema>;
export type MetadataSelectSecondType = z.infer<typeof metadataSelectSecondSchema>;