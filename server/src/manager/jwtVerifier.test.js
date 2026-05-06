import crypto from "node:crypto";
import { describe, test, expect, beforeEach } from "vitest";
import {
  decodeJwtPayload,
  verifyManagerToken,
  assertInstanceMatch,
  resetJwtSecretCacheForTests,
} from "./jwtVerifier.mjs";

// 32-byte symmetric secret for HS256. Real secrets come from the
// manager's `getJwtSecretForInjection` (ADR 0010); for tests any
// 32 random bytes work.
const SECRET = crypto.randomBytes(32);

// Build a real HS256-signed JWT with overridable header + claims.
// Tests that exercise the alg-rejection path pass an `alg` override;
// tests that exercise the signature-mismatch path pass a `signWith`
// override (a different secret) so the math is real but the verifier
// rejects.
function makeToken(claims, { alg = "HS256", signWith = SECRET } = {}) {
  const header = Buffer.from(JSON.stringify({ alg, typ: "JWT" })).toString(
    "base64url",
  );
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", signWith)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

// Build a token with a literal signature segment (e.g. "" for `alg=none`,
// or a corrupted signature). The signing math is skipped entirely.
function makeTokenWithLiteralSig(claims, sig, { alg = "HS256" } = {}) {
  const header = Buffer.from(JSON.stringify({ alg, typ: "JWT" })).toString(
    "base64url",
  );
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${body}.${sig}`;
}

const validClaims = (overrides = {}) => ({
  instance_id: "inst_abc",
  batch_id: "bat_def",
  study_id: "stu_ghi",
  workspace_id: "ws_jkl",
  iat: Math.floor(Date.now() / 1000) - 60,
  exp: Math.floor(Date.now() / 1000) + 24 * 3600,
  aud: "manager",
  scope: "tick",
  kid: "v1",
  ...overrides,
});

beforeEach(() => {
  resetJwtSecretCacheForTests();
  delete process.env.JWT_VERIFY_SECRET;
});

describe("decodeJwtPayload", () => {
  test("decodes a well-formed token's payload", () => {
    const claims = validClaims();
    const token = makeToken(claims);
    expect(decodeJwtPayload(token)).toEqual(claims);
  });

  test("rejects a non-string token", () => {
    expect(() => decodeJwtPayload(undefined)).toThrow(/non-empty string/);
    expect(() => decodeJwtPayload(null)).toThrow(/non-empty string/);
    expect(() => decodeJwtPayload("")).toThrow(/non-empty string/);
  });

  test("rejects a token without 3 parts", () => {
    expect(() => decodeJwtPayload("only.two")).toThrow(
      /3 base64url-encoded parts/,
    );
    expect(() => decodeJwtPayload("a.b.c.d")).toThrow(
      /3 base64url-encoded parts/,
    );
  });

  test("rejects a token whose payload isn't valid JSON", () => {
    const garbage = Buffer.from("not json").toString("base64url");
    expect(() => decodeJwtPayload(`hdr.${garbage}.sig`)).toThrow(/valid JSON/);
  });
});

describe("verifyManagerToken — happy path", () => {
  test("returns parsed claims for a token signed with the configured secret", () => {
    const claims = validClaims();
    const token = makeToken(claims);
    expect(verifyManagerToken(token, { secret: SECRET })).toEqual(claims);
  });

  test("respects the injected `now` for expiry testing", () => {
    const claims = validClaims();
    const token = makeToken(claims);
    const now = () => (claims.exp - 60) * 1000;
    expect(verifyManagerToken(token, { secret: SECRET, now })).toEqual(claims);
  });

  test("reads JWT_VERIFY_SECRET from env when secret arg omitted", () => {
    process.env.JWT_VERIFY_SECRET = SECRET.toString("base64");
    const claims = validClaims();
    const token = makeToken(claims);
    expect(verifyManagerToken(token)).toEqual(claims);
  });
});

describe("verifyManagerToken — alg-confusion defense", () => {
  test("rejects `alg: none` (the canonical bypass attack)", () => {
    const claims = validClaims();
    const token = makeTokenWithLiteralSig(claims, "", { alg: "none" });
    expect(() => verifyManagerToken(token, { secret: SECRET })).toThrow(
      /alg "none" not supported/,
    );
  });

  test("rejects `alg: RS256` (defends against algorithm-confusion swaps)", () => {
    // A real attacker would swap to RS256 hoping the verifier treats
    // the public key as the HMAC secret. We just need the alg-check
    // gate to slam shut before any HMAC math runs.
    const claims = validClaims();
    const token = makeTokenWithLiteralSig(claims, "irrelevant", {
      alg: "RS256",
    });
    expect(() => verifyManagerToken(token, { secret: SECRET })).toThrow(
      /alg "RS256" not supported/,
    );
  });

  test("rejects an unsupported alg even before the secret is read", () => {
    // No secret configured + no secret arg → if the alg check ran
    // SECOND it would surface a "missing secret" error. The alg
    // check runs FIRST so the message is about the alg.
    const claims = validClaims();
    const token = makeTokenWithLiteralSig(claims, "", { alg: "none" });
    expect(() => verifyManagerToken(token)).toThrow(/alg "none" not supported/);
  });
});

describe("verifyManagerToken — signature verification", () => {
  test("rejects a token signed with a different secret", () => {
    const otherSecret = crypto.randomBytes(32);
    const claims = validClaims();
    const token = makeToken(claims, { signWith: otherSecret });
    expect(() => verifyManagerToken(token, { secret: SECRET })).toThrow(
      /signature mismatch/,
    );
  });

  test("rejects a token whose payload was mutated post-signing", () => {
    const claims = validClaims();
    const token = makeToken(claims);
    // Re-pack the token with a tampered payload but the original
    // signature — signature was over the original payload, so
    // verification must fail.
    const [header, , sig] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...claims, instance_id: "mallory" }),
    ).toString("base64url");
    const tampered = `${header}.${tamperedPayload}.${sig}`;
    expect(() => verifyManagerToken(tampered, { secret: SECRET })).toThrow(
      /signature mismatch/,
    );
  });

  test("rejects when JWT_VERIFY_SECRET is missing and no secret is injected", () => {
    const claims = validClaims();
    const token = makeToken(claims);
    expect(() => verifyManagerToken(token)).toThrow(
      /JWT_VERIFY_SECRET env var is required/,
    );
  });

  test("rejects a JWT_VERIFY_SECRET that decodes to fewer than 32 bytes", () => {
    // 16-byte key, base64-encoded — would HMAC fine but is half the
    // strength ADR 0010 specifies. Catch this at the env-read seam
    // rather than letting a silently-weak key be cached.
    process.env.JWT_VERIFY_SECRET = crypto.randomBytes(16).toString("base64");
    const claims = validClaims();
    const token = makeToken(claims);
    expect(() => verifyManagerToken(token)).toThrow(
      /decoded to 16 bytes; need at least 32/,
    );
  });

  test("rejects a JWT_VERIFY_SECRET that isn't valid base64", () => {
    // Non-base64 input decodes to empty/garbage rather than throwing.
    // We catch the resulting too-short Buffer at the same seam.
    process.env.JWT_VERIFY_SECRET = "!!!not base64 at all!!!";
    const claims = validClaims();
    const token = makeToken(claims);
    expect(() => verifyManagerToken(token)).toThrow(/need at least 32/);
  });
});

describe("verifyManagerToken — claims validation", () => {
  test("rejects an expired token", () => {
    const expired = validClaims({
      iat: 1700000000,
      exp: 1700000000 + 60,
    });
    const token = makeToken(expired);
    expect(() => verifyManagerToken(token, { secret: SECRET })).toThrow(
      /expired/i,
    );
  });

  test("rejects wrong audience", () => {
    const wrongAud = validClaims({ aud: "researcher-session" });
    const token = makeToken(wrongAud);
    expect(() => verifyManagerToken(token, { secret: SECRET })).toThrow(
      /aud.*invalid|aud.*literal|invalid_literal/i,
    );
  });

  test("rejects wrong scope", () => {
    const wrongScope = validClaims({ scope: "admin" });
    const token = makeToken(wrongScope);
    expect(() => verifyManagerToken(token, { secret: SECRET })).toThrow(
      /scope/i,
    );
  });

  test("rejects missing instance_id", () => {
    const c = validClaims();
    delete c.instance_id;
    const token = makeToken(c);
    expect(() => verifyManagerToken(token, { secret: SECRET })).toThrow(
      /instance_id/i,
    );
  });

  test("rejects an unknown kid (rotation guard)", () => {
    // Future-proofing for ADR 0010's rotation procedure: if the
    // manager mints under "v2" before this runtime image is bumped,
    // we MUST refuse rather than silently verify under "v1"'s key.
    const futureKid = validClaims({ kid: "v2" });
    const token = makeToken(futureKid);
    expect(() => verifyManagerToken(token, { secret: SECRET })).toThrow(
      /kid "v2" not in KNOWN_KIDS/,
    );
  });
});

describe("assertInstanceMatch", () => {
  test("passes when token instance_id matches env INSTANCE_ID", () => {
    const claims = { ...validClaims(), instance_id: "inst_match" };
    expect(() => assertInstanceMatch(claims, "inst_match")).not.toThrow();
  });

  test("throws on mismatch with a clear diagnostic", () => {
    const claims = { ...validClaims(), instance_id: "inst_a" };
    expect(() => assertInstanceMatch(claims, "inst_b")).toThrow(
      /instance_id mismatch|inst_a.*inst_b/,
    );
  });
});
