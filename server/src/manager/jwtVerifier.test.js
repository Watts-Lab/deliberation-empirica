import { describe, test, expect } from "vitest";
import {
  decodeJwtPayload,
  verifyManagerToken,
  assertInstanceMatch,
} from "./jwtVerifier.mjs";

// Build an unsigned JWT with a custom payload — base64url(header).
// base64url(payload).<empty signature>. The runtime doesn't verify
// the signature (manager#14 / #29), so the signature segment can be
// anything for these tests.
function makeToken(claims, { signature = "sig" } = {}) {
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${body}.${signature}`;
}

const validClaims = () => ({
  instance_id: "inst_abc",
  batch_id: "bat_def",
  study_id: "stu_ghi",
  workspace_id: "ws_jkl",
  iat: Math.floor(Date.now() / 1000) - 60,
  exp: Math.floor(Date.now() / 1000) + 24 * 3600,
  aud: "manager",
  scope: "tick",
  kid: "v1",
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

describe("verifyManagerToken", () => {
  test("returns parsed claims for a valid token", () => {
    const claims = validClaims();
    const token = makeToken(claims);
    expect(verifyManagerToken(token)).toEqual(claims);
  });

  test("rejects an expired token", () => {
    const expired = {
      ...validClaims(),
      iat: 1700000000,
      exp: 1700000000 + 60, // long ago
    };
    expect(() => verifyManagerToken(makeToken(expired))).toThrow(/expired/i);
  });

  test("rejects wrong audience", () => {
    const wrongAud = { ...validClaims(), aud: "researcher-session" };
    expect(() => verifyManagerToken(makeToken(wrongAud))).toThrow(
      /aud.*invalid|aud.*literal|invalid_literal/i,
    );
  });

  test("rejects wrong scope", () => {
    const wrongScope = { ...validClaims(), scope: "admin" };
    expect(() => verifyManagerToken(makeToken(wrongScope))).toThrow(/scope/i);
  });

  test("rejects missing instance_id", () => {
    const c = validClaims();
    delete c.instance_id;
    expect(() => verifyManagerToken(makeToken(c))).toThrow(/instance_id/i);
  });

  test("respects the injected `now` for testability", () => {
    const claims = validClaims();
    const token = makeToken(claims);
    // Lock `now` to something that makes the token still valid.
    const now = () => (claims.exp - 60) * 1000;
    expect(verifyManagerToken(token, { now })).toEqual(claims);
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
