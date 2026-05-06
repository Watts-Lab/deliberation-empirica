import { describe, expect, it } from "vitest";
import { jwtClaims } from "../jwt.mjs";

const validClaims = {
  instance_id: "inst_abc",
  batch_id: "bat_def",
  study_id: "stu_ghi",
  workspace_id: "ws_jkl",
  iat: 1714000000,
  exp: 1716592000,
  aud: "manager",
  scope: "tick",
  kid: "v1",
};

describe("jwtClaims", () => {
  it("accepts a complete claim set", () => {
    const c = jwtClaims.parse(validClaims);
    expect(c.instance_id).toBe("inst_abc");
  });

  it("accepts a custom kid (rotation)", () => {
    const c = jwtClaims.parse({ ...validClaims, kid: "v2" });
    expect(c.kid).toBe("v2");
  });

  it("rejects a missing kid (required for HS256 secret selection per ADR 0010)", () => {
    const { kid: _omit, ...rest } = validClaims;
    expect(() => jwtClaims.parse(rest)).toThrow();
  });

  it("rejects an empty kid", () => {
    expect(() => jwtClaims.parse({ ...validClaims, kid: "" })).toThrow();
  });

  it("rejects wrong audience", () => {
    expect(() =>
      jwtClaims.parse({ ...validClaims, aud: "researcher-session" }),
    ).toThrow();
  });

  it("rejects wrong scope", () => {
    expect(() => jwtClaims.parse({ ...validClaims, scope: "admin" })).toThrow();
  });

  it("rejects missing instance_id", () => {
    const { instance_id: _omit, ...rest } = validClaims;
    expect(() => jwtClaims.parse(rest)).toThrow();
  });
});
