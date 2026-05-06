import { z } from "zod";

import { tickError } from "./tick.mjs";

/**
 * Structured error catalog the runtime emits via tick.errors[].
 *
 * Each entry has:
 * - `code`        — stable identifier (UPPER_SNAKE_CASE).
 * - `kind`        — `validation` (researcher-actionable) or
 *                   `platform-error` (platform-team triage). Drives
 *                   which surface receives the error per manager
 *                   interface-contract.md §"Error surfacing: two
 *                   pipelines".
 * - `details`     — Zod schema for the per-code structured payload
 *                   the manager's friendly-error renderer (DR-1)
 *                   shapes into per-code affordances (e.g. "Open at
 *                   line N in GitHub", dropdown of `definedNames`,
 *                   "Re-verify S3 credentials").
 *
 * Codes added here in lockstep with new validation paths in the
 * runtime. The manager's renderer falls back to plain `message` for
 * codes it doesn't yet have a per-code component for.
 */

const httpStatus = z.number().int().min(100).max(599);

/* --- Treatment-file errors ------------------------------------- */

const treatmentFileNotFoundDetails = z.object({
  expectedPath: z.string(),
  repo: z.string().optional(),
  branch: z.string().optional(),
  expectedSha: z.string().optional(),
  httpStatus,
});

const treatmentFileParseErrorDetails = z.object({
  path: z.string(),
  line: z.number().int().positive().optional(),
  column: z.number().int().positive().optional(),
  parseMessage: z.string(),
});

const treatmentNameNotDefinedDetails = z.object({
  requestedName: z.string(),
  definedNames: z.array(z.string()),
});

const introSequenceNotDefinedDetails = z.object({
  requestedName: z.string(),
  definedNames: z.array(z.string()),
});

/* --- Asset errors --------------------------------------------- */

const stageAssetNotFoundDetails = z.object({
  assetPath: z.string(),
  stageName: z.string(),
  treatmentName: z.string(),
  httpStatus,
  candidates: z.array(z.string()).optional(),
});

const assetBaseUrlUnreachableDetails = z.object({
  assetBaseUrl: z.string().url(),
  error: z.string(),
});

/* --- GitHub App errors ---------------------------------------- */

const githubAppNotInstalledDetails = z.object({
  owner: z.string(),
  workspaceId: z.string().optional(),
});

const githubAppLacksRepoAccessDetails = z.object({
  owner: z.string(),
  repo: z.string(),
  installationId: z.string().optional(),
});

/* --- Provider auth errors ------------------------------------- */

const videoStorageAuthFailedDetails = z.object({
  bucket: z.string(),
  region: z.string(),
  awsErrorCode: z.string(),
});

/* --- Batch-config shape errors -------------------------------- */

const payoffsLengthMismatchDetails = z.object({
  payoffsLength: z.number().int().nonnegative(),
  treatmentsLength: z.number().int().nonnegative(),
});

/* --- Catalog --------------------------------------------------- */

export const ERROR_CATALOG = {
  TREATMENT_FILE_NOT_FOUND: {
    kind: "validation",
    details: treatmentFileNotFoundDetails,
  },
  TREATMENT_FILE_PARSE_ERROR: {
    kind: "validation",
    details: treatmentFileParseErrorDetails,
  },
  TREATMENT_NAME_NOT_DEFINED: {
    kind: "validation",
    details: treatmentNameNotDefinedDetails,
  },
  INTRO_SEQUENCE_NOT_DEFINED: {
    kind: "validation",
    details: introSequenceNotDefinedDetails,
  },
  STAGE_ASSET_NOT_FOUND: {
    kind: "validation",
    details: stageAssetNotFoundDetails,
  },
  ASSET_BASE_URL_UNREACHABLE: {
    kind: "platform-error",
    details: assetBaseUrlUnreachableDetails,
  },
  GITHUB_APP_NOT_INSTALLED_ON_OWNER: {
    kind: "validation",
    details: githubAppNotInstalledDetails,
  },
  GITHUB_APP_LACKS_REPO_ACCESS: {
    kind: "validation",
    details: githubAppLacksRepoAccessDetails,
  },
  VIDEO_STORAGE_AUTH_FAILED: {
    kind: "validation",
    details: videoStorageAuthFailedDetails,
  },
  PAYOFFS_LENGTH_MISMATCH: {
    kind: "validation",
    details: payoffsLengthMismatchDetails,
  },
};

export const errorCode = z.enum([...Object.keys(ERROR_CATALOG)]);

/** Validate a single error against the catalog before emitting it on
 *  a tick. Three checks:
 *
 *  1. Base tick-error shape (id / code / kind / retryable / message).
 *  2. Code is registered. The wire schema (`tickError`) accepts
 *     free-form codes so a newer runtime can emit a code older
 *     manager parsers don't know about; this helper is the tighter
 *     emit-side gate that catches typos at the source.
 *  3. `details` matches the per-code Zod schema in the catalog.
 *
 *  Used by the runtime when building a tick error; the manager
 *  validates only the wire shape on receipt (so codes from newer
 *  runtimes still pass through to the friendly-error renderer's
 *  message-fallback path). */
export function validateCatalogError(err) {
  tickError.parse(err);
  const entry = ERROR_CATALOG[err.code];
  if (!entry) {
    throw new Error(
      `Unknown error code "${err.code}". Add it to ERROR_CATALOG in contracts/errors.mjs first.`,
    );
  }
  if (err.kind !== entry.kind) {
    throw new Error(
      `Error ${err.code} is registered as kind="${entry.kind}", but emit attempted with kind="${err.kind}"`,
    );
  }
  if (err.details !== undefined) {
    entry.details.parse(err.details);
  }
  return err;
}
