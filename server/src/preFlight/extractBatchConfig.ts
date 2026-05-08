/**
 * Pull the actual batch config out of the Empirica `"config"` attribute,
 * which can arrive in two shapes:
 *
 *  - **Solo-dev** (Empirica classic-admin UI): a wrapper of shape
 *    `{ config: <actualConfig>, ...otherFields }`. Classic-admin's
 *    CreateBatch form bundles the user's batch config alongside
 *    other UI-side fields under a single `"config"` attribute.
 *
 *  - **Manager-launched**: the synthesized batch config sits at the
 *    attribute value directly, no wrapper. See
 *    `deliberation-lab/manager` `src/lib/spawn.ts`'s `serviceCreate`,
 *    which writes `attributes: [{ key: "config", val: JSON.stringify(batchConfig) }]`.
 *
 * Discriminate on `study_id` presence — the same sentinel
 * `validateBatchConfig.ts` uses. A solo-dev wrapper has neither
 * `top.study_id` (it's the wrapper, not the config) nor
 * `top.config.study_id` (solo configs don't carry it). A
 * manager-launched flat config always carries a non-empty `study_id`
 * (per `synthesizedBatchConfig` in `@deliberation-lab/contracts/batch-config`).
 *
 * Returns the inner config; validation (and the same `study_id`
 * discriminator at validator level) happens downstream in
 * `validateBatchConfig`.
 */
export function extractBatchConfig(rawConfigAttr: unknown): unknown {
  if (
    rawConfigAttr &&
    typeof rawConfigAttr === "object" &&
    typeof (rawConfigAttr as { study_id?: unknown }).study_id === "string" &&
    (rawConfigAttr as { study_id: string }).study_id.length > 0
  ) {
    // Manager-launched: the flat synthesizedBatchConfig is the value.
    return rawConfigAttr;
  }
  // Solo-dev wrapper: dive into `.config`. Returns undefined if the
  // wrapper is null/undefined or missing the inner field — let the
  // downstream validator surface that as a "Required" error rather
  // than throwing a confusing TypeError on destructure here.
  return (rawConfigAttr as { config?: unknown } | null | undefined)?.config;
}
