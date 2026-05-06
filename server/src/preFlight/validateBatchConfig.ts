import { z } from "zod";
import {
  baseBatchConfigFields,
  applyCommonInvariants,
  synthesizedBatchConfig,
} from "@deliberation-lab/contracts/batch-config";

/**
 * Runtime-side batch-config validation. Mode-discriminated:
 *
 * - **Solo-dev** configs (researcher-authored, served from the admin
 *   UI or pulled from a JSON fixture) carry per-batch GitHub
 *   destinations (`preregRepos`, `dataRepos`) and use the shared
 *   `assetBaseUrl` for treatment + asset resolution.
 *
 * - **Manager-launched** configs (synthesized by the manager and
 *   pushed via Tajriba `addScopes(kind="batch")`) carry manager-
 *   identity fields (`study_id`, `batch_id`, `instance_id`). The
 *   manager owns the data destination via the tick-channel pass-
 *   through (per ADR 0005) so the legacy repo fields are absent.
 *
 * Both shapes spread the same `baseBatchConfigFields` from
 * `contracts/batch-config.mjs` and run the same cross-cutting
 * invariants via `applyCommonInvariants` — single source of truth.
 *
 * `validateBatchConfig()` discriminates by sentinel: presence of
 * `study_id` on the input picks the manager-launched schema; its
 * absence picks the solo schema. This keeps both schemas pure
 * functions of input (no env reads at validate time), per #112's
 * recommendation.
 */

const repoSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  branch: z.string(),
  directory: z.string(),
});

const soloDevBatchConfig = applyCommonInvariants(
  z
    .object({
      ...baseBatchConfigFields,
      preregRepos: z.array(repoSchema, {
        message: `If you do not wish to specify a separate preregistration repository, enter an empty array "[]"`,
      }),
      dataRepos: z.array(repoSchema),
    })
    .strict(),
);

export const batchConfigSchema = soloDevBatchConfig;

export class ValidationError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function formatZodError(error: z.ZodError): string {
  const formatted = error.format() as Record<string, any>;
  const generalErrors = (formatted._errors as string[]) || [];
  const keyErrors = Object.keys(formatted)
    .filter((key) => key[0] !== "_")
    .map((key) => `${key}: ${formatted[key]?._errors?.join(" - ")}`);
  return `Problem(s) in batch config:\n- ${[
    ...generalErrors,
    ...keyErrors,
  ].join("\n- ")}`;
}

export function validateBatchConfig(config: unknown) {
  // Discriminate by a *truthy non-empty* `study_id`: a researcher who
  // accidentally sets `study_id: ""` on a solo config would otherwise
  // hit synthesizedBatchConfig.strict() and get a confusing
  // "Unrecognized key: preregRepos" error rather than a clear "study_id
  // must be non-empty" — and an empty/null study_id never identifies
  // a real manager-launched batch anyway.
  const studyId =
    typeof config === "object" && config !== null
      ? (config as Record<string, unknown>).study_id
      : undefined;
  const isManagerLaunched = typeof studyId === "string" && studyId.length > 0;
  const schema = isManagerLaunched
    ? synthesizedBatchConfig
    : soloDevBatchConfig;
  const result = schema.safeParse(config);
  if (!result.success) {
    throw new ValidationError(formatZodError(result.error));
  }
  return result.data;
}
