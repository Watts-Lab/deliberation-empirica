import { describe, expect, it } from "vitest";
import { ERROR_CATALOG, errorCode, validateCatalogError } from "../errors.mjs";

describe("ERROR_CATALOG", () => {
  it("includes the codes the manager dashboard renders affordances for", () => {
    for (const code of [
      "TREATMENT_FILE_NOT_FOUND",
      "TREATMENT_FILE_PARSE_ERROR",
      "TREATMENT_NAME_NOT_DEFINED",
      "INTRO_SEQUENCE_NOT_DEFINED",
      "STAGE_ASSET_NOT_FOUND",
      "ASSET_BASE_URL_UNREACHABLE",
      "GITHUB_APP_NOT_INSTALLED_ON_OWNER",
      "GITHUB_APP_LACKS_REPO_ACCESS",
      "VIDEO_STORAGE_AUTH_FAILED",
      "PAYOFFS_LENGTH_MISMATCH",
    ]) {
      expect(ERROR_CATALOG[code]).toBeDefined();
    }
  });

  it("tags every entry as either validation or platform-error", () => {
    for (const entry of Object.values(ERROR_CATALOG)) {
      expect(["validation", "platform-error"]).toContain(entry.kind);
    }
  });
});

describe("errorCode", () => {
  it("accepts a registered code", () => {
    expect(errorCode.parse("TREATMENT_FILE_NOT_FOUND")).toBe(
      "TREATMENT_FILE_NOT_FOUND",
    );
  });

  it("rejects an unregistered code", () => {
    expect(() => errorCode.parse("MADE_UP_CODE")).toThrow();
  });
});

describe("validateCatalogError", () => {
  const baseErr = {
    id: "e-1",
    kind: "validation",
    code: "TREATMENT_FILE_NOT_FOUND",
    retryable: false,
    message: "treatment file missing",
  };

  it("validates details against the per-code schema", () => {
    const ok = validateCatalogError({
      ...baseErr,
      details: {
        expectedPath: "treatments/main.yaml",
        repo: "deliberation-lab/study-x",
        branch: "main",
        expectedSha: "abc123",
        httpStatus: 404,
      },
    });
    expect(ok.code).toBe("TREATMENT_FILE_NOT_FOUND");
  });

  it("rejects details that don't match the per-code schema", () => {
    expect(() =>
      validateCatalogError({
        ...baseErr,
        details: { httpStatus: "not-a-number" },
      }),
    ).toThrow();
  });

  it("rejects an unknown code", () => {
    expect(() =>
      validateCatalogError({ ...baseErr, code: "MADE_UP" }),
    ).toThrow();
  });

  it("rejects a kind mismatch", () => {
    expect(() =>
      validateCatalogError({ ...baseErr, kind: "platform-error" }),
    ).toThrow();
  });

  it("rejects a malformed base error (no retryable)", () => {
    const { retryable: _omit, ...rest } = baseErr;
    expect(() => validateCatalogError(rest)).toThrow();
  });

  it("rejects a malformed base error (no message)", () => {
    const { message: _omit, ...rest } = baseErr;
    expect(() => validateCatalogError(rest)).toThrow();
  });
});
