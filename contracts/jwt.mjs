import { z } from "zod";

/**
 * Per-Instance JWT claims the manager signs at `serviceCreate` and
 * the runtime verifies on every tick POST.
 *
 * Long-lived for the Instance lifetime — no refresh mechanism at
 * MVP. Batches are short (hours to days), Instances are ephemeral;
 * simpler to refuse multi-month Instances than to maintain a
 * refresh path. `exp` is set generously (e.g. 30 days) per the
 * manager's interface-contract.md §"Auth surface".
 *
 * Shape lives here so both the runtime (verifier) and the manager
 * (signer) agree on the claim names + types.
 */
export const jwtClaims = z.object({
  // Identifies the specific runtime container this token is bound
  // to. The manager checks this against the path parameter on
  // `POST /api/instances/:id/tick` and rejects the request if they
  // don't match (token replay across Instances).
  instance_id: z.string().min(1),
  batch_id: z.string().min(1),
  study_id: z.string().min(1),
  workspace_id: z.string().min(1),
  // Standard JWT timestamps in seconds since epoch.
  iat: z.number().int().nonnegative(),
  exp: z.number().int().nonnegative(),
  // Static — distinguishes manager-bound tokens from any other JWT
  // the platform might mint (e.g. researcher session cookies).
  aud: z.literal("manager"),
  // Static — distinguishes the tick channel from any future per-
  // Instance JWT scopes (currently there are none, but the field is
  // future-proofing).
  scope: z.literal("tick"),
  // Required key id — manager mints under (currently `"v1"` per
  // manager `src/contracts/jwt.ts` `DEFAULT_KID`); runtime selects
  // the verify secret by kid (per manager ADR 0010 §"How rotation
  // works" + deliberation-lab#109). Tokens without a kid can't be
  // verified — the runtime fails fast on "unknown kid" so it can't
  // silently fall back to whatever secret it has when a v2 secret
  // rotates in.
  kid: z.string().min(1),
});
