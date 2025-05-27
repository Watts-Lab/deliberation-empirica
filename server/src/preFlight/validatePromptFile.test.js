import { expect, test } from "vitest";
import { metadataBaseSchema, metadataSchema } from "./validatePromptFile";

// ----------- Base Schema Validation ------------

test("valid metadata passes base schema", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "openResponse",
    notes: "This is a valid example",
  };
  const result = metadataBaseSchema.safeParse(metadata);
  if (!result.success) console.log(result.error);
  expect(result.success).toBe(true);
});

test("missing type field fails base schema", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
  };
  const result = metadataBaseSchema.safeParse(metadata);
  expect(result.success).toBe(false);
});

test("invalid type value fails base schema", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "invalidType",
  };
  const result = metadataBaseSchema.safeParse(metadata);
  expect(result.success).toBe(false);
});

test("notes field is optional", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "multipleChoice",
  };
  const result = metadataBaseSchema.safeParse(metadata);
  expect(result.success).toBe(true);
});

// ----------- Refined Schema Validation ------------

test("valid metadata with matching filename passes refined schema", () => {
  const filename = "mock-prompt-files/prompt.md";
  const metadata = {
    name: filename,
    type: "noResponse",
  };
  const result = metadataSchema(filename).safeParse(metadata);
  expect(result.success).toBe(true);
});

test("metadata name not matching filename fails refined schema", () => {
  const filename = "mock-prompt-files/prompt.md";
  const metadata = {
    name: "mock-prompt-files/WRONG.md",
    type: "openResponse",
  };
  const result = metadataSchema(filename).safeParse(metadata);
  if (!result.success) {
    console.log(result.error.issues);
  }
  expect(result.success).toBe(false);
});
