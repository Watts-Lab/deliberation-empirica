// HS256 JWT signature verification for the harness's `jwtVerify:
// "hs256"` mode. Implements the same shape the manager itself uses
// (manager/src/lib/instanceToken.ts `verifyInstanceToken`) and that
// the runtime will adopt under [#109](https://github.com/deliberation-lab/deliberation-lab/issues/109).
//
// Why a small helper instead of pulling in `jsonwebtoken`: the
// algorithm-confusion attack surface is small, the verifier is
// ~30 lines of crypto.createHmac, and the runtime is going to ship
// its own implementation per ADR 0010 anyway. Once #109 lands and
// exports the runtime's verifier, the harness can switch to
// importing it for line-for-line parity.
//
// Reject early before parsing claims — header alg-confusion checks
// run before the signature verify so an `alg: "none"` token can't
// even reach the timing-safe-equal path.

import { createHmac, timingSafeEqual } from "node:crypto";

// Decode a base64url JWT segment. Returns the parsed JSON or
// throws on malformed structure / non-JSON content.
function decodeSegment(segment) {
  const json = Buffer.from(segment, "base64url").toString("utf8");
  return JSON.parse(json);
}

// Verify a JWT under HS256. `secret` may be a Buffer or a base64url
// / base64 string (the manager injects base64 per ADR 0010 §"How
// rotation works").
//
// Returns the parsed claims object on success. Throws with a
// reason string on any structural / algorithm / signature /
// expiration failure.
export function verifyHs256(token, secret) {
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("token must be a non-empty string");
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("malformed JWT: expected 3 base64url-encoded parts");
  }
  const [headerSeg, payloadSeg, sigSeg] = parts;

  let header;
  try {
    header = decodeSegment(headerSeg);
  } catch (e) {
    throw new Error(`invalid JWT header: ${e.message}`);
  }
  // Algorithm confusion defense — reject `alg: "none"` and any
  // non-HS256 alg before HMAC-comparing. An attacker can't downgrade
  // a token by re-signing it with a different alg.
  if (header.alg !== "HS256") {
    throw new Error(
      `unsupported JWT alg "${header.alg}" — harness only accepts HS256`,
    );
  }

  const secretBuf = Buffer.isBuffer(secret)
    ? secret
    : Buffer.from(secret, "base64");
  const expected = createHmac("sha256", secretBuf)
    .update(`${headerSeg}.${payloadSeg}`)
    .digest("base64url");
  const got = Buffer.from(sigSeg);
  const exp = Buffer.from(expected);
  if (got.length !== exp.length || !timingSafeEqual(got, exp)) {
    throw new Error("JWT signature mismatch");
  }

  let payload;
  try {
    payload = decodeSegment(payloadSeg);
  } catch (e) {
    throw new Error(`invalid JWT payload: ${e.message}`);
  }
  // Expiration check after signature verify — if the signature
  // already failed, exp is irrelevant. ~30s skew tolerance per
  // typical JWT practice.
  const now = Math.floor(Date.now() / 1000);
  const skewSec = 30;
  if (typeof payload.exp === "number" && payload.exp + skewSec <= now) {
    throw new Error(
      `JWT expired at ${new Date(payload.exp * 1000).toISOString()}`,
    );
  }
  return payload;
}
