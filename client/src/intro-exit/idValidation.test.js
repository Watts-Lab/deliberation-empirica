import { describe, expect, test } from "vitest";
import { validateId } from "./idValidation";

/**
 * Pure-function tests for IdForm's `validateId`.
 *
 * Replaces the validation branches cypress/e2e/10_Etherpad_Qualtrics.js
 * exercised through the rendered UI (lines 61-104) — that test was
 * `it.skip`'d, so today there is zero coverage for these branches.
 *
 * The validator runs on every input change in `PlayerIdEntry` and
 * gates the Join button. The contract:
 *   - returns `{ validatedId, errors }` where errors is a string array
 *   - validatedId is the trimmed input
 *   - errors[] is empty when the input passes all rules
 *   - rules:
 *       1. invalid characters (anything not [a-zA-Z0-9_-])
 *       2. < 2 characters
 *       3. > 64 characters
 *     reported with priority 1 > 2 > 3 (the source uses else-if, so
 *     only ONE error message is emitted at a time)
 */

describe("validateId", () => {
  test("empty string → 'at least 2 characters'", () => {
    const { validatedId, errors } = validateId("");
    expect(validatedId).toBe("");
    expect(errors).toEqual(["Please enter at least 2 characters"]);
  });

  test("undefined / null → 'at least 2 characters' (defensive)", () => {
    expect(validateId(undefined).errors).toEqual([
      "Please enter at least 2 characters",
    ]);
    expect(validateId(null).errors).toEqual([
      "Please enter at least 2 characters",
    ]);
  });

  test("single character → 'at least 2 characters'", () => {
    const { validatedId, errors } = validateId("a");
    expect(validatedId).toBe("a");
    expect(errors).toEqual(["Please enter at least 2 characters"]);
  });

  test("invalid chars take priority over length rules", () => {
    // The string is too short AND has invalid chars. Per the source's
    // else-if chain, the invalid-chars message is emitted first; the
    // length rule is suppressed.
    const { errors } = validateId("a#");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("invalid characters");
    expect(errors[0]).toContain('"#"');
  });

  test("invalid chars: spaces, punctuation, special characters", () => {
    const { errors } = validateId("InvalidChars_#!*&");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("invalid characters");
    expect(errors[0]).toContain('"#"');
    expect(errors[0]).toContain('"!"');
    expect(errors[0]).toContain('"*"');
    expect(errors[0]).toContain('"&"');
  });

  test("65-char input → 'no more than 64 characters'", () => {
    const tooLong = "a".repeat(65);
    const { validatedId, errors } = validateId(tooLong);
    expect(validatedId).toBe(tooLong);
    expect(errors).toEqual(["Please enter no more than 64 characters"]);
  });

  test("64-char input → no error (boundary)", () => {
    const { errors } = validateId("a".repeat(64));
    expect(errors).toEqual([]);
  });

  test("exactly 2 chars → no error (boundary)", () => {
    const { errors } = validateId("ab");
    expect(errors).toEqual([]);
  });

  test("valid: alphanumeric + underscore + hyphen", () => {
    const { validatedId, errors } = validateId("abc-123_DEF");
    expect(validatedId).toBe("abc-123_DEF");
    expect(errors).toEqual([]);
  });

  test("input is trimmed before length checks", () => {
    // "  ab  " trims to "ab" (length 2). Pre-trim length is 6, post-
    // trim is 2 — must use the post-trim length.
    expect(validateId("  ab  ").errors).toEqual([]);
    expect(validateId(" a ").errors).toEqual([
      "Please enter at least 2 characters",
    ]);
  });

  test("validatedId is the trimmed value, not the raw input", () => {
    expect(validateId("  hello  ").validatedId).toBe("hello");
  });

  test("matches the cypress 10 corpus exactly", () => {
    // The cypress 10 spec (skipped) exercised these inputs in order;
    // pin all of them so a future change to the validator shows up
    // here even if the cypress spec stays retired.
    expect(validateId("s").errors).toEqual([
      "Please enter at least 2 characters",
    ]);
    expect(validateId("InvalidChars_#!*&").errors[0]).toContain(
      "invalid characters",
    );
    expect(
      validateId(
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      ).errors,
    ).toEqual(["Please enter no more than 64 characters"]);
    // A typical playerKey from the cypress harness.
    expect(validateId("testplayer_1234567890123").errors).toEqual([]);
  });
});
