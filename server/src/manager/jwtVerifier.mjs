import { jwtClaims } from "@deliberation-lab/contracts/jwt";

// Decode + claim-validate the per-Instance JWT. Signature
// verification (HS256 + JWT_VERIFY_SECRET, per manager ADR 0010 +
// deliberation-lab#109) lands as a follow-up — until then the
// boot-time decode + claims-schema check + INSTANCE_ID cross-check
// is the gate, plus the manager's own signature-verify on every
// received tick on the inbound side.
//
// Decoding here serves three purposes:
//
//   1. Sanity-check the token's structure at boot (3 base64url parts).
//   2. Validate claims against contracts/jwt.mjs (catches truncation,
//      wrong-shape claims, missing required fields).
//   3. Extract `instance_id` so the runtime can cross-check it
//      against the INSTANCE_ID env var — protects against the
//      manager mis-injecting a token meant for a different
//      Instance container.

function base64UrlDecode(str) {
  // Node's Buffer accepts "base64url" since 16.x; fall back to
  // padding+replace for older runtimes if needed.
  return Buffer.from(str, "base64url").toString("utf8");
}

export function decodeJwtPayload(token) {
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("JWT must be a non-empty string");
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error(
      `Malformed JWT: expected 3 base64url-encoded parts separated by dots, got ${parts.length}`,
    );
  }
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

// Decode + validate. Returns the parsed claims object on success;
// throws on any structural / schema / expiration failure with a
// message the runtime can surface in its boot logs.
export function verifyManagerToken(token, { now = Date.now } = {}) {
  const payload = decodeJwtPayload(token);
  const result = jwtClaims.safeParse(payload);
  if (!result.success) {
    throw new Error(
      `JWT claims failed validation: ${result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")}`,
    );
  }
  const claims = result.data;
  const nowSeconds = Math.floor(now() / 1000);
  if (claims.exp <= nowSeconds) {
    throw new Error(
      `JWT expired at ${new Date(claims.exp * 1000).toISOString()} (now ${new Date(nowSeconds * 1000).toISOString()})`,
    );
  }
  return claims;
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
