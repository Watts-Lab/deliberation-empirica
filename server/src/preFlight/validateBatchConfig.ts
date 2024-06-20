import { array, z } from "zod";
import { getText } from "../providers/cdn";

export const batchConfigSchema = z
  .object({
    batchName: z.string(),
    cdn: z.enum(["test", "prod", "local"]),
    treatmentFile: z.string().regex(/\.yaml$/),
    // introSequence: z.literal("none").or(z.string()),
    introSequence: z.string().or(
      z.literal("none", {
        message: `If you do not wish to use an intro sequence, enter value "none"`,
      })
    ),
    treatments: z.array(z.string()).nonempty(),
    payoffs: z
      .array(z.number().positive())
      .nonempty()
      .or(
        z.literal("equal", {
          message: `If you do not wish to define different payoffs for each treatment, enter value "equal"`,
        })
      ),
    knockdowns: z
      .union([
        z.number().gt(0).lte(1),
        z.array(z.number().gt(0).lte(1)).nonempty(),
        z.array(z.array(z.number().gt(0).lte(1)).nonempty()).nonempty(),
      ])
      .or(
        z.literal("none", {
          message: `If you do not wish to use payoff knockdowns, enter value "none"`,
        })
      ),
    exitCodes: z
      .object({
        complete: z.string(),
        error: z.string(),
        lobbyTimeout: z.string(),
      })
      .or(
        z.literal("none", {
          message: `If you do not wish to supply exit codes, enter value "none"`,
        })
      ),
    launchDate: z
      .string()
      .transform((str) => new Date(str))
      .refine((date) => date > new Date(), {
        message: `Launch date must be in the future. If you do not wish to use a launch date, enter value "immediate"`,
      })
      .or(
        z.literal("immediate", {
          message: `If you do not wish to use a launch date, enter value "immediate"`,
        })
      ),
    customIdInstructions: z
      .string()
      .refine((value) => value.endsWith(".md"), {
        message:
          'Custom ID instructions should be implemented as a markdown file, ending with ".md"',
      })
      .or(
        z.literal("none", {
          message: `If you do not wish to provide custom ID instructions, enter value "none"`,
        })
      ),
    platformConsent: z.enum(["US", "EU", "UK"]),
    consentAddendum: z.string().or(
      z.literal("none", {
        message: `If you do not wish to use an additional consent addendum, enter value "none"`,
      })
    ),
    dispatchWait: z.number().positive(),
    videoStorage: z
      .object({
        bucket: z.string(),
        region: z.enum([
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
      .or(
        z.literal("none", {
          message: `If you do not wish to store video, enter value "none"`,
        })
      ),
    preregRepos: z.array(
      z.object({
        owner: z.string(),
        repo: z.string(),
        branch: z.string(),
        directory: z.string(),
      }),
      {
        message: `If you do not wish to specify a separate preregistration repository, enter an empty array "[]"`,
      }
    ),
    dataRepos: z.array(
      z.object({
        owner: z.string(),
        repo: z.string(),
        branch: z.string(),
        directory: z.string(),
      })
    ),
    centralPrereg: z.boolean({
      message: `Must be a boolean. If you do not wish to preregister to the central repository, enter "false"`,
    }),
    checkAudio: z.boolean({
      message: `Must be a boolean. If you do not wish to check participant audio, enter "false"`,
    }),
    checkVideo: z.boolean({
      message: `Must be a boolean. If you do not wish to check participant video, enter "false"`,
    }),
  })
  .strict()
  .superRefine((obj, ctx) => {
    // check that length of payoffs matches length of treatments
    if (
      obj.payoffs !== "equal" &&
      obj.treatments.length !== obj.payoffs.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Number of payoffs must match number of treatments, or be set to "equal"`,
        path: ["payoffs"],
      });
    }

    if (obj.checkVideo && !obj.checkAudio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
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
              code: z.ZodIssueCode.custom,
              message: `Number of rows in knockdown matrix must match number of treatments`,
              path: ["knockdowns"],
            });
          }
          obj.knockdowns.forEach((row, index) => {
            // check that all rows have same length as treatments
            if (!Array.isArray(row) || row.length !== obj.treatments.length) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Knockdown matrix row ${index} must match number of treatments`,
                path: ["knockdowns"],
              });
            }
          });
        } else {
          if (obj.knockdowns.length !== obj.treatments.length) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Number of knockdowns must match number of treatments`,
              path: ["knockdowns"],
            });
          }
        }
      }
    }
  });

class ValidationError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validateBatchConfig(config) {
  const result = batchConfigSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.format();
    const generalErrors = errors["_errors"];
    const keyErrors = Object.keys(errors).map((key, index) =>
      key[0] !== "_" ? `${key}: ${errors[key]["_errors"]?.join(" - ")}` : ""
    );
    throw new ValidationError(
      `Problem(s) in batch config:\n- ${[...generalErrors, ...keyErrors].join(
        "\n- "
      )}`
    );
  }
  return result.data;
}
