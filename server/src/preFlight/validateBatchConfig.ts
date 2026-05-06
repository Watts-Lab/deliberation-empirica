import { array, z } from "zod";

const urlParamRegex = /^[a-zA-Z0-9_-]+$/;

const customIdInstructionsSchema = z.any().superRefine((data, ctx) => {
  console.log("data", data, "tyepof", typeof data);
  if (typeof data === "string") {
    if (data.endsWith(".md")) {
      return;
    } else if (data === "none") {
      return;
    } else {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Custom ID instructions should be a markdown file ending with ".md" or "none"',
      });
    }
  } else if (
    typeof data === "object" &&
    data !== null &&
    !Array.isArray(data)
  ) {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CustomIdInstructions dictionary must not be empty",
      });
      return;
    }
    for (const key of keys) {
      if (!urlParamRegex.test(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Keys must be valid URL parameters (alphanumeric, underscores, or hyphens) or "default"`,
        });
      }
      const value = data[key];
      if (typeof value !== "string" || !value.endsWith(".md")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Values must be strings ending with ".md". Got "${value}" for key "${key}"`,
        });
      }
    }
  } else {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Custom ID instructions should be a string or a dictionary with valid URL parameters as keys and markdown files as values",
    });
  }
});

export const batchConfigSchema = z
  .object({
    batchName: z.string(),
    // Solo-dev / isolated-instance mode: pick one of the bundled CDN
    // env-var URLs by key. Optional because the manager-launched
    // alternative is to supply `assetBaseUrl` + `assetsRepoSha`
    // directly (per ADR 0009 — manager mirrors per-Study assets to
    // a random S3 prefix, no enum needed).
    cdn: z.enum(["test", "prod", "local"]).optional(),
    // Manager-launched mode: the manager-mirrored S3 prefix under
    // which `treatmentFile` and `asset://` references resolve. When
    // present, the runtime ignores `cdn`. Either-or enforced in the
    // superRefine below. Trailing slashes are rejected here because
    // server + client both build asset URLs by raw `${assetBaseUrl}/
    // ${path}` concatenation — a trailing slash would produce `//`
    // which many CDNs treat as a different key (and 404).
    assetBaseUrl: z
      .string()
      .url()
      .refine((u) => !u.endsWith("/"), {
        message:
          "assetBaseUrl must not end with a trailing slash (raw concatenation produces `//`)",
      })
      .optional(),
    // Manager-supplied snapshot SHA of the connected repo. When
    // present, the runtime stamps it on every science-data row
    // instead of querying GitHub for the head sha at boot. Optional
    // for backward compat with the cdn-enum path.
    assetsRepoSha: z.string().min(1).optional(),
    treatmentFile: z.string().regex(/\.yaml$/),
    // introSequence: z.literal("none").or(z.string()),
    introSequence: z.string().or(
      z.literal("none", {
        message: `If you do not wish to use an intro sequence, enter value "none"`,
      }),
    ),
    treatments: z.array(z.string()).nonempty(),
    payoffs: z
      .array(z.number().positive())
      .nonempty()
      .or(
        z.literal("equal", {
          message: `If you do not wish to define different payoffs for each treatment, enter value "equal"`,
        }),
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
        }),
      ),
    exitCodes: z
      .object({
        complete: z.string(),
        error: z.string(),
        lobbyTimeout: z.string(),
        failedEquipmentCheck: z.string(),
      })
      .or(
        z.literal("none", {
          message: `If you do not wish to supply exit codes, enter value "none"`,
        }),
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
        }),
      ),
    customIdInstructions: customIdInstructionsSchema,
    platformConsent: z.enum(["US", "EU", "UK", "custom"]),
    consentAddendum: z.string().or(
      z.literal("none", {
        message: `If you do not wish to use an additional consent addendum, enter value "none"`,
      }),
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
        }),
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
      },
    ),
    dataRepos: z.array(
      z.object({
        owner: z.string(),
        repo: z.string(),
        branch: z.string(),
        directory: z.string(),
      }),
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
    debrief: z
      .string()
      .endsWith(".md", {
        message: `Debrief must be a markdown file ending with ".md" or "none"`,
      })
      .or(
        z.literal("none", {
          message: `If you do not wish to use custom debrief content, enter value "none"`,
        }),
      ),
  })
  .strict()
  .superRefine((obj, ctx) => {
    // The runtime supports two asset-resolution modes — exactly one
    // must be configured per batch. `cdn` is the historical solo-dev
    // path (env-var-bundled CDN URLs by key); `assetBaseUrl` is the
    // manager-launched path (per-Study mirrored S3 prefix per
    // ADR 0009). Allowing both at once would be ambiguous; allowing
    // neither leaves the runtime with nowhere to fetch treatments
    // from.
    const hasCdn = obj.cdn !== undefined;
    const hasAssetBaseUrl = obj.assetBaseUrl !== undefined;
    if (!hasCdn && !hasAssetBaseUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Either "cdn" (solo-dev) or "assetBaseUrl" (manager-launched) must be set',
        path: ["cdn"],
      });
    }
    if (hasCdn && hasAssetBaseUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Set either "cdn" or "assetBaseUrl", not both — they select mutually exclusive asset-resolution paths',
        path: ["assetBaseUrl"],
      });
    }
    // Manager-launched mode requires `assetsRepoSha` alongside
    // `assetBaseUrl`. Without the SHA, callbacks.js would fall back
    // to `getAssetsRepoSha()` — a hard-coded GitHub-API lookup of
    // `Watts-Lab/deliberation-assets:main`, which has no relation
    // to the manager-mirrored Study repo. That stamps incorrect
    // asset provenance on every science/prereg/post-flight row,
    // silently. Better to fail validation than ship bad data.
    if (hasAssetBaseUrl && obj.assetsRepoSha === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          '"assetsRepoSha" is required when "assetBaseUrl" is set (manager mints both at SS-10/SS-11; missing it would stamp the wrong repo SHA on data exports)',
        path: ["assetsRepoSha"],
      });
    }

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

export type BatchConfigType = z.infer<typeof batchConfigSchema>;

class ValidationError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "ValidationError";
  }
}

//changed line 260 errors type so it would throw no errors in deliberation-lab-tools, if it breaks something then revert this change
export function validateBatchConfig(config: unknown) {
  const result = batchConfigSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.format();
    const generalErrors = errors["_errors"];
    const keyErrors = Object.keys(errors).map((key, index) =>
      key[0] !== "_"
        ? `${key}: ${(errors as Record<string, any>)[key]["_errors"]?.join(" - ")}`
        : "",
    );
    throw new ValidationError(
      `Problem(s) in batch config:\n- ${[...generalErrors, ...keyErrors].join(
        "\n- ",
      )}`,
    );
  }
  return result.data;
}
