import { z } from "zod";

/**
 * Batch-config schema — source of truth for the field shapes both
 * the runtime (defense-in-depth in `validateBatchConfig.ts`) and the
 * manager (compose-time validation of synthesized configs) use.
 *
 * Three exports:
 *
 * - `baseBatchConfigFields` — the field-name → Zod-schema map shared
 *   by both manager-launched and solo-dev modes. Either mode spreads
 *   this into its own `z.object({...})` and adds mode-specific fields
 *   on top (manager: `study_id`/`batch_id`/`instance_id` for cross-
 *   system correlation; solo: `preregRepos`/`dataRepos` for the
 *   direct-Octokit save path).
 *
 * - `applyCommonInvariants(schema)` — wraps a schema with the cross-
 *   cutting superRefines that apply to both modes: payoffs/treatments
 *   length match, checkVideo→checkAudio coupling, knockdowns matrix
 *   shape rules.
 *
 * - `synthesizedBatchConfig` — manager-launched specialization.
 *   Composed from `baseBatchConfigFields` + manager identity. The
 *   manager pushes this into the runtime via Tajriba `addScopes(
 *   kind="batch")` at Instance startup per manager interface-
 *   contract.md §"Batch-config composition and injection".
 *
 * Field semantics:
 *
 * - `assetBaseUrl` (with `assetsRepoSha`) — public-read URL prefix
 *   under which `treatmentFile` + asset references resolve, plus the
 *   git SHA of the connected repo at the loaded snapshot. In manager-
 *   launched mode the mirror is YAML-reference-driven (per manager
 *   #181 and ADR 0009): the manager loads the selected `*.stagebook.
 *   yaml` (legacy: `*.treatments.yaml`), expands it through stagebook's
 *   `fillTemplates`, walks references via `getReferencedAssets`, and
 *   uploads that closure to a random per-Study S3 prefix anchored at
 *   the LCA of the YAML + every referenced path. No `assets/` directory
 *   convention — referenced files can live anywhere in the repo. The
 *   manager pre-computes `assetsRepoSha` against the same snapshot. In
 *   solo-dev mode the researcher specifies these directly. Trailing
 *   slash is rejected because both server + client build asset URLs
 *   by raw `${assetBaseUrl}/${path}` concatenation.
 * - `customIdInstructions` — typed union (string `.md` path, "none"
 *   sentinel, or per-URL-param record). Modeled as a real union so
 *   `z.infer<>` types are useful downstream rather than `any`.
 * - `launchDate` — kept as a string at the schema level. Wire format
 *   is JSON; transforming to `Date` here would change `z.infer<>` to
 *   `Date | "immediate"`, giving consumers the wrong type. Parsed at
 *   use sites, not at the schema boundary.
 */

const urlParamRegex = /^[a-zA-Z0-9_-]+$/;

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

/**
 * Field shapes shared by manager-launched and solo-dev batch configs.
 * Both modes spread this into their own `z.object({...})` and add
 * mode-specific fields on top.
 */
export const baseBatchConfigFields = {
  /* lifecycle / labelling */
  batchName: z.string(),

  /* asset resolution */
  assetBaseUrl: z
    .string()
    .url()
    .refine((u) => !u.endsWith("/"), {
      message:
        "assetBaseUrl must not end with a trailing slash (raw concatenation produces `//`)",
    }),
  treatmentFile: z.string().regex(/\.yaml$/),
  /* Optional in the shared base — manager-launched mode always
     supplies it (per ADR 0009 the manager pins the connected repo's
     SHA at SS-10/SS-11/fork). Solo-dev researchers can supply it for
     data-export reproducibility but aren't required to; if absent
     the runtime stamps "unknown" on the JSONL rows that would carry
     it, rather than falling back to a hard-coded GitHub-API lookup. */
  assetsRepoSha: z.string().min(1).optional(),

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
      // IAM role ARN that Daily assumes to write recordings into the
      // researcher's bucket. The bucket policy must grant
      // sts:AssumeRole to this role. Carried in the contract (rather
      // than hardcoded in the runtime) so researcher-owned buckets
      // can point at their own role. Manager-side provisioning
      // pre-fills this with the platform ARN for the common case.
      assumeRoleArn: z.string().regex(/^arn:aws:iam::\d{12}:role\/.+$/, {
        message:
          "assumeRoleArn must be a valid IAM role ARN " +
          "(arn:aws:iam::<12-digit-account>:role/<role-name>)",
      }),
    })
    .or(z.literal("none")),

  /* debrief */
  debrief: z.string().endsWith(".md").or(z.literal("none")),
};

/**
 * Cross-cutting superRefines that apply to both modes:
 *
 *   1. `payoffs.length === treatments.length` (or `payoffs === "equal"`)
 *   2. `checkVideo` requires `checkAudio` (server-side WebRTC needs
 *      audio if it's negotiating video)
 *   3. `knockdowns` matrix shape — when an array, must be either a
 *      flat 1D matching treatments.length or a square 2D matrix
 *      whose dimensions match treatments.length
 *
 * Apply to a built `z.object({...}).strict()` schema by calling
 * `applyCommonInvariants(schema)`. Composes via `.superRefine()` so
 * the wrapped schema's `.parse()` / `.safeParse()` returns the same
 * `ZodObject<...>` shape.
 */
export function applyCommonInvariants(schema) {
  return schema.superRefine((obj, ctx) => {
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
}

/**
 * Plain ZodObject form of the synthesized batch config (manager-supplied
 * identity + `baseBatchConfigFields`), without the cross-field
 * `applyCommonInvariants` superRefine.
 *
 * Exported so consumers can do object-level schema operations that
 * refined/effects schemas don't support — most importantly `.pick(...)`
 * to derive sub-schemas for UI form validation. (Zod 4 makes this a
 * hard runtime error; Zod 3 is more permissive but still doesn't compose
 * cleanly across .pick().) The fully-validated `synthesizedBatchConfig`
 * below applies `applyCommonInvariants` on top of this for compose-time
 * / on-receipt validation; that's still the canonical surface for
 * actually parsing a config.
 */
export const synthesizedBatchConfigShape = z
  .object({
    /* manager-synthesized identity */
    study_id: z.string().min(1),
    batch_id: z.string().min(1),
    instance_id: z.string().min(1),
    ...baseBatchConfigFields,
  })
  .strict();

/**
 * Manager-launched specialization. Composed from `baseBatchConfigFields`
 * + manager-synthesized identity (`study_id`, `batch_id`, `instance_id`)
 * for cross-system correlation. The manager validates against this at
 * compose time; the runtime validates against it on receipt as
 * defense-in-depth.
 */
export const synthesizedBatchConfig = applyCommonInvariants(
  synthesizedBatchConfigShape,
);
