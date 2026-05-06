import crypto from "node:crypto";
import { jwtClaims } from "@deliberation-lab/contracts/jwt";

/**
 * Decode + claim-validate + HS256-verify the per-Instance JWT.
 *
 * Verification order — early rejects defend against alg-confusion and
 * key-rotation drift before we ever touch the claims:
 *
 *   1. Structural decode (3 base64url parts).
 *   2. Header `alg === "HS256"` — rejects `alg=none` and asymmetric
 *      algorithms attackers might swap in to bypass HMAC verification.
 *   3. HMAC-SHA256 signature over `header.payload`, constant-time
 *      compared against the token's third segment.
 *   4. Payload claims schema (contracts/jwt.mjs).
 *   5. `kid` ∈ KNOWN_KIDS — rotation drives a coordinated runtime
 *      image bump (per manager ADR 0010 §"How rotation works"). Failing
 *      fast here prevents the runtime from silently accepting a token
 *      minted under a future key with whatever secret it has.
 *   6. `exp > now` (with the call-site allowed to inject `now` for
 *      testability).
 *
 * The secret comes from `JWT_VERIFY_SECRET` (base64-decoded once + held
 * in module scope) per manager ADR 0010 + manager#135. Production
 * callers omit `{ secret }`; tests inject an explicit Buffer.
 */

const KNOWN_KIDS = new Set(["v1"]);

let cachedSecret = null;

// Minimum decoded-secret length. RFC 8554 / ADR 0010 specify a 32-byte
// HMAC-SHA256 key; rejecting anything shorter prevents a silently-weak
// key sneaking in if the manager's spawn pipeline ever injects a
// malformed `JWT_VERIFY_SECRET`. `Buffer.from(raw, "base64")` is
// permissive — non-base64 input decodes to an empty/garbage Buffer
// rather than throwing — so we explicitly enforce the floor here.
const MIN_SECRET_BYTES = 32;

function getJwtVerifySecret() {
  if (cachedSecret) return cachedSecret;
  const raw = process.env.JWT_VERIFY_SECRET;
  if (!raw) return null;
  // Manager sends base64 (per its `getJwtSecretForInjection`); decode
  // once at first use and cache. A 32-byte HMAC key encodes to ~44
  // chars of base64.
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length < MIN_SECRET_BYTES) {
    throw new Error(
      `JWT_VERIFY_SECRET decoded to ${decoded.length} bytes; need at least ${MIN_SECRET_BYTES} (ADR 0010 specifies a 32-byte HS256 key). Likely the manager spawn pipeline injected a malformed value, or the env value isn't valid base64.`,
    );
  }
  cachedSecret = decoded;
  return cachedSecret;
}

// Test-only: drop the cached secret so subsequent calls re-read env.
// Production code should never call this — exposed under a distinct
// name so it's grep-able when auditing for accidental production use.
export function resetJwtSecretCacheForTests() {
  cachedSecret = null;
}

function base64UrlDecode(str) {
  return Buffer.from(str, "base64url").toString("utf8");
}

function splitToken(token) {
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("JWT must be a non-empty string");
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error(
      `Malformed JWT: expected 3 base64url-encoded parts separated by dots, got ${parts.length}`,
    );
  }
  return parts;
}

export function decodeJwtPayload(token) {
  const parts = splitToken(token);
  let json;
  try {
    json = base64UrlDecode(parts[1]);
  } catch (e) {
    throw new Error(`JWT payload is not valid base64url: ${e.message}`);
  }
  let payload;
  try {
    payload = JSON.parse(json);
  } catch (e) {
    throw new Error(`JWT payload is not valid JSON: ${e.message}`);
  }
  return payload;
}

function decodeJwtHeader(headerSeg) {
  let json;
  try {
    json = base64UrlDecode(headerSeg);
  } catch (e) {
    throw new Error(`JWT header is not valid base64url: ${e.message}`);
  }
  try {
    return JSON.parse(json);
  } catch (e) {
    throw new Error(`JWT header is not valid JSON: ${e.message}`);
  }
}

// Constant-time compare on base64url strings of equal length. The
// HMAC + the candidate signature are the same length when both are
// valid HS256, so a length mismatch alone is enough to reject — but
// guarding the `timingSafeEqual` call against unequal lengths is also
// required by the Node API.
function constantTimeBase64UrlEqual(a, b) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Decode payload + validate claims (schema + `kid` known-set + `exp`).
 *
 * Does NOT verify the signature. Used by `verifyManagerToken` (after
 * the alg + HMAC gates) and exported separately for the manager-mock
 * harness's `decode-only` mode, where tests mint unsigned tokens and
 * exercise downstream paths without dealing with a signing key.
 *
 * Production callers in the runtime should always go through
 * `verifyManagerToken` instead — claims + exp without signature is
 * not a security boundary.
 */
export function decodeAndValidateClaims(token, { now = Date.now } = {}) {
  const payload = decodeJwtPayload(token);
  const result = jwtClaims.safeParse(payload);
  if (!result.success) {
    throw new Error(
      `JWT claims failed validation: ${result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")}`,
    );
  }
  const claims = result.data;
  if (!KNOWN_KIDS.has(claims.kid)) {
    throw new Error(
      `JWT kid "${claims.kid}" not in KNOWN_KIDS (${[...KNOWN_KIDS].join(", ")}). A coordinated runtime-image bump is required before the manager rotates to a new kid.`,
    );
  }
  const nowSeconds = Math.floor(now() / 1000);
  if (claims.exp <= nowSeconds) {
    throw new Error(
      `JWT expired at ${new Date(claims.exp * 1000).toISOString()} (now ${new Date(nowSeconds * 1000).toISOString()})`,
    );
  }
  return claims;
}

/**
 * Decode + verify HS256 signature + validate claims.
 *
 * Returns the parsed claims object on success; throws on any
 * structural / signature / schema / kid / expiration failure with a
 * message the runtime can surface in its boot logs.
 *
 * @param {string} token  JWT to verify.
 * @param {object} [opts]
 * @param {() => number} [opts.now]  Override the time source for tests.
 * @param {Buffer} [opts.secret]  Override the HMAC secret for tests.
 *   Production callers omit this so the value is read once from
 *   `JWT_VERIFY_SECRET` and cached.
 */
export function verifyManagerToken(token, { now = Date.now, secret } = {}) {
  const parts = splitToken(token);
  const [headerSeg, payloadSeg, sigSeg] = parts;

  // 1. Reject non-HS256 *before* anything else. This is the
  //    canonical defense against the `alg=none` attack and against
  //    algorithm-confusion (where an attacker swaps to RS256 and the
  //    HMAC verifier ends up using the public key as the shared key).
  const header = decodeJwtHeader(headerSeg);
  if (header.alg !== "HS256") {
    throw new Error(
      `JWT header alg "${header.alg}" not supported; expected "HS256" (per manager ADR 0010)`,
    );
  }

  // 2. HMAC-verify the signature over the canonical
  //    `${headerSeg}.${payloadSeg}` input — same input the manager
  //    signed at mint. Constant-time compare to avoid leaking
  //    timing information on the secret.
  const verifySecret = secret ?? getJwtVerifySecret();
  if (!verifySecret) {
    throw new Error(
      "JWT_VERIFY_SECRET env var is required to verify manager tokens (per manager ADR 0010 + deliberation-lab#109)",
    );
  }
  const expectedSig = crypto
    .createHmac("sha256", verifySecret)
    .update(`${headerSeg}.${payloadSeg}`)
    .digest("base64url");
  if (!constantTimeBase64UrlEqual(sigSeg, expectedSig)) {
    throw new Error(
      "JWT signature mismatch — token was not signed with the configured JWT_VERIFY_SECRET, or the payload was tampered with after minting",
    );
  }

  // 3. Now and only now do we trust the payload enough to parse it.
  //    Claims schema + kid + exp share a code path with the
  //    decode-only mode used by the manager-mock harness.
  return decodeAndValidateClaims(token, { now });
}

// Defense-in-depth: confirm the token's instance_id matches the
// INSTANCE_ID the manager set on this container. Catches the case
// where the manager's spawn pipeline mis-injected a token meant for
// a different Instance — that's a bug worth surfacing loudly rather
// than letting the runtime quietly tick to the wrong endpoint.
export function assertInstanceMatch(claims, instanceId) {
  if (claims.instance_id !== instanceId) {
    throw new Error(
      `JWT instance_id mismatch: token claims "${claims.instance_id}" but env INSTANCE_ID is "${instanceId}". Manager spawn pipeline likely mis-injected the token.`,
    );
  }
}
