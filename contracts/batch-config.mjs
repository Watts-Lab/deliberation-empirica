import { z } from "zod";

/**
 * Synthesized batch config the manager pushes into the runtime via
 * Tajriba `addScopes(kind="batch", attributes=[{key:"config", val:
 * JSON.stringify(synthesized)}])` at Instance startup, per manager
 * interface-contract.md §"Batch-config composition and injection".
 *
 * Subset of the historical `server/src/preFlight/validateBatchConfig.ts`
 * schema, with three changes:
 *
 * 1. **Drop fields the manager now owns**:
 *    - `cdn`             — replaced by `assetBaseUrl` + `treatmentFile`
 *                          + `assetsRepoSha` (per ADR 0009).
 *    - `preregRepos`     — manager owns the data destination per
 *                          ADR 0005 §"Pass-through data flow".
 *    - `dataRepos`       — same.
 *    - `centralPrereg`   — same.
 *
 * 2. **Add manager-supplied asset fields**:
 *    - `assetBaseUrl`    — public-read S3 URL prefix under which the
 *                          manager has mirrored the Study's
 *                          currently-loaded snapshot of the
 *                          `*.treatments.yaml` files plus
 *                          everything under `assets/`. Random per-
 *                          Study path token.
 *    - `assetsRepoSha`   — SHA of the connected repo at the loaded
 *                          snapshot. Pre-computed by manager;
 *                          replaces the runtime's prior
 *                          `getAssetsRepoSha()` GitHub-API lookup.
 *                          Written to every JSONL row of the
 *                          science-data export for reproducibility.
 *
 * 3. **Add manager-synthesized identifiers** for cross-system
 *    correlation: `study_id`, `batch_id`, `instance_id`. No
 *    data-flow secrets — auth is via the per-Instance JWT on the
 *    tick channel, not the batch config.
 *
 * The runtime validates this schema on receipt as defense-in-depth
 * (the manager has already validated at compose time). Schema drift
 * surfaces as a runtime-side validation failure with structured
 * errors emitted via the tick channel.
 *
 * The runtime-side migration to consume these new fields is tracked
 * in deliberation-lab#71. Until that lands, `validateBatchConfig.ts`
 * still requires `cdn`; this schema is the target shape.
 */

const urlParamRegex = /^[a-zA-Z0-9_-]+$/;

// Either a single markdown file (with a "none" sentinel for opt-out)
// or a per-URL-param map of markdown files. Modeled as a typed union
// so `z.infer<typeof synthesizedBatchConfig>` carries useful types
// downstream — the original `z.any().superRefine(...)` shape erased
// to `any` for TS consumers.
const customIdInstructionsSchema = z.union([
  z.string().endsWith(".md", {
    message:
      'Custom ID instructions string must end with ".md" or be the literal "none"',
  }),
  z.literal("none"),
  z
    .record(
      z.string().regex(urlParamRegex, {
        message:
          "Keys must be valid URL parameters (alphanumeric, underscores, or hyphens)",
      }),
      z.string().endsWith(".md", {
        message: 'Values must be strings ending with ".md"',
      }),
    )
    .refine((d) => Object.keys(d).length > 0, {
      message: "CustomIdInstructions dictionary must not be empty",
    }),
]);

const awsRegion = z.enum([
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
]);

export const synthesizedBatchConfig = z
  .object({
    /* manager-synthesized identity */
    study_id: z.string().min(1),
    batch_id: z.string().min(1),
    instance_id: z.string().min(1),

    /* lifecycle / labelling */
    batchName: z.string(),

    /* asset resolution — replaces `cdn`. Trailing-slash rejection
       mirrors validateBatchConfig.ts; both server + client build asset
       URLs by raw `${assetBaseUrl}/${path}` concatenation, so a
       trailing slash produces `//` which CDN/S3 backends often treat
       as a different key (and 404). */
    assetBaseUrl: z
      .string()
      .url()
      .refine((u) => !u.endsWith("/"), {
        message:
          "assetBaseUrl must not end with a trailing slash (raw concatenation produces `//`)",
      }),
    treatmentFile: z.string().regex(/\.yaml$/),
    assetsRepoSha: z.string().min(1),

    /* treatments and dispatcher */
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

    /* exit codes + lifecycle */
    exitCodes: z
      .object({
        complete: z.string(),
        error: z.string(),
        lobbyTimeout: z.string(),
        failedEquipmentCheck: z.string(),
      })
      .or(z.literal("none")),
    // Wire format is a JSON string (the manager serializes the batch
    // config and pushes it via Tajriba `addScopes`); using a Zod
    // transform to a `Date` here would change `z.infer<>` to
    // `Date | "immediate"`, giving manager + runtime consumers the
    // wrong type for the external contract. The string is parsed
    // into a `Date` at use sites, not at the schema boundary.
    launchDate: z.union([
      z
        .string()
        .datetime({
          offset: true,
          message: "Launch date must be an ISO 8601 datetime string",
        })
        .refine((s) => new Date(s) > new Date(), {
          message: "Launch date must be in the future",
        }),
      z.literal("immediate"),
    ]),

    /* participant onboarding */
    customIdInstructions: customIdInstructionsSchema,
    platformConsent: z.enum(["US", "EU", "UK", "custom"]),
    consentAddendum: z.string().or(z.literal("none")),
    dispatchWait: z.number().positive(),

    /* equipment checks */
    checkAudio: z.boolean(),
    checkVideo: z.boolean(),

    /* video storage */
    videoStorage: z
      .object({
        bucket: z.string(),
        region: awsRegion,
      })
      .or(z.literal("none")),

    /* debrief */
    debrief: z.string().endsWith(".md").or(z.literal("none")),
  })
  .strict()
  .superRefine((obj, ctx) => {
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

    if (obj.knockdowns !== "none" && Array.isArray(obj.knockdowns)) {
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
          if (!Array.isArray(row) || row.length !== obj.treatments.length) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Knockdown matrix row ${index} must match number of treatments`,
              path: ["knockdowns"],
            });
          }
        });
      } else if (obj.knockdowns.length !== obj.treatments.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Number of knockdowns must match number of treatments`,
          path: ["knockdowns"],
        });
      }
    }
  });
