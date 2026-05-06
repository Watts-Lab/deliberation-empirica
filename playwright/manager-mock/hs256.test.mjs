import { describe, test, expect } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { verifyHs256 } from "./hs256.mjs";

// Mint a JWT with an arbitrary header + claims, signed under
// `secret`. Doesn't depend on jsonwebtoken so the test stays
// hermetic (and matches manager/src/lib/instanceToken.ts's mint
// shape line-for-line).
function mintToken({ header, payload, secret }) {
  const headerSeg = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadSeg = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret)
    .update(`${headerSeg}.${payloadSeg}`)
    .digest("base64url");
  return `${headerSeg}.${payloadSeg}.${sig}`;
}

const validHeader = () => ({ alg: "HS256", typ: "JWT", kid: "v1" });
const validPayload = (overrides = {}) => ({
  instance_id: "i-1",
  batch_id: "b-1",
  study_id: "s-1",
  workspace_id: "w-1",
  iat: Math.floor(Date.now() / 1000) - 60,
  exp: Math.floor(Date.now() / 1000) + 24 * 3600,
  aud: "manager",
  scope: "tick",
  kid: "v1",
  ...overrides,
});

describe("verifyHs256 — happy path", () => {
  test("verifies a token signed with the same secret + returns claims", () => {
    const secret = randomBytes(32);
    const token = mintToken({
      header: validHeader(),
      payload: validPayload(),
      secret,
    });
    const claims = verifyHs256(token, secret);
    expect(claims.instance_id).toBe("i-1");
    expect(claims.aud).toBe("manager");
  });

  test("accepts a base64-string secret (manager injects base64 per ADR 0010)", () => {
    const secretBuf = randomBytes(32);
    const secretB64 = secretBuf.toString("base64");
    const token = mintToken({
      header: validHeader(),
      payload: validPayload(),
      secret: secretBuf,
    });
    const claims = verifyHs256(token, secretB64);
    expect(claims.instance_id).toBe("i-1");
  });
});

describe("verifyHs256 — algorithm-confusion defense", () => {
  test("rejects alg=none (the canonical attack)", () => {
    const secret = randomBytes(32);
    const headerSeg = Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" }),
    ).toString("base64url");
    const payloadSeg = Buffer.from(JSON.stringify(validPayload())).toString(
      "base64url",
    );
    const token = `${headerSeg}.${payloadSeg}.`;
    expect(() => verifyHs256(token, secret)).toThrow(/unsupported JWT alg/);
  });

  test("rejects alg=RS256 (the swap-algorithm-confusion attack)", () => {
    const secret = randomBytes(32);
    const token = mintToken({
      header: { alg: "RS256", typ: "JWT", kid: "v1" },
      payload: validPayload(),
      secret, // doesn't matter — algorithm check fires before signature check
    });
    expect(() => verifyHs256(token, secret)).toThrow(/unsupported JWT alg/);
  });
});

describe("verifyHs256 — signature integrity", () => {
  test("rejects a token signed with a different secret", () => {
    const aliceSecret = randomBytes(32);
    const bobSecret = randomBytes(32);
    const token = mintToken({
      header: validHeader(),
      payload: validPayload(),
      secret: aliceSecret,
    });
    expect(() => verifyHs256(token, bobSecret)).toThrow(/signature mismatch/);
  });

  test("rejects a tampered payload (signature was for original)", () => {
    const secret = randomBytes(32);
    const token = mintToken({
      header: validHeader(),
      payload: validPayload(),
      secret,
    });
    const [hdr, , sig] = token.split(".");
    // Substitute a different payload, keeping original signature.
    const tamperedPayload = Buffer.from(
      JSON.stringify(validPayload({ instance_id: "i-evil" })),
    ).toString("base64url");
    const tampered = `${hdr}.${tamperedPayload}.${sig}`;
    expect(() => verifyHs256(tampered, secret)).toThrow(/signature mismatch/);
  });
});

describe("verifyHs256 — expiration", () => {
  test("rejects an expired token (with skew tolerance)", () => {
    const secret = randomBytes(32);
    const expired = validPayload({
      iat: Math.floor(Date.now() / 1000) - 3600,
      // 60s past expiration is well outside the 30s skew tolerance.
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    const token = mintToken({
      header: validHeader(),
      payload: expired,
      secret,
    });
    expect(() => verifyHs256(token, secret)).toThrow(/expired/i);
  });

  test("accepts a recently-expired token within the 30s skew window", () => {
    const secret = randomBytes(32);
    const recentlyExpired = validPayload({
      // 5s past exp — within tolerance.
      exp: Math.floor(Date.now() / 1000) - 5,
    });
    const token = mintToken({
      header: validHeader(),
      payload: recentlyExpired,
      secret,
    });
    expect(() => verifyHs256(token, secret)).not.toThrow();
  });
});

describe("verifyHs256 — structural rejection", () => {
  test("rejects an empty token", () => {
    expect(() => verifyHs256("", randomBytes(32))).toThrow(/non-empty/);
  });

  test("rejects a token without 3 dot-separated parts", () => {
    expect(() => verifyHs256("only.two", randomBytes(32))).toThrow(
      /3 base64url/,
    );
  });

  test("rejects a token with a non-JSON header", () => {
    const garbage = Buffer.from("not json").toString("base64url");
    const payloadSeg = Buffer.from(JSON.stringify(validPayload())).toString(
      "base64url",
    );
    expect(() =>
      verifyHs256(`${garbage}.${payloadSeg}.sig`, randomBytes(32)),
    ).toThrow(/invalid JWT header/);
  });
});
