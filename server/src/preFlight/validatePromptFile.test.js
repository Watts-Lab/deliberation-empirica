import { expect, test } from "vitest";
import {
  metadataTypeSchema,
  metadataRefineSchema,
  metadataLogicalSchema,
} from "./validatePromptFile";

// ----------- Type Schema Validation (metadataTypeSchema) ------------

test("valid metadata passes type schema", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "openResponse",
    notes: "Optional notes",
    rows: 3,
  };
  const result = metadataTypeSchema.safeParse(metadata);
  if (!result.success) console.log(result.error);
  expect(result.success).toBe(true);
});

test("missing required type field fails type schema", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
  };
  const result = metadataTypeSchema.safeParse(metadata);
  expect(result.success).toBe(false);
});

test("invalid type value fails type schema", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "invalidType",
  };
  const result = metadataTypeSchema.safeParse(metadata);
  expect(result.success).toBe(false);
});

test("notes field is optional in type schema", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "noResponse",
  };
  const result = metadataTypeSchema.safeParse(metadata);
  expect(result.success).toBe(true);
});

// ----------- Refined Validation (metadataRefineSchema) ------------

test("valid refined metadata passes all refine rules", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "openResponse",
    rows: 5,
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(true);
});

test("invalid: rows provided but type is not openResponse", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "multipleChoice",
    rows: 3,
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
});

test("invalid: select provided but type is not multipleChoice", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "openResponse",
    select: "single",
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
});

test("invalid: shuffleOptions provided but type is noResponse", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "noResponse",
    shuffleOptions: true,
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
});

// ----------- Logical Schema (metadataLogicalSchema) ------------

test("valid logical schema with matching file name", () => {
  const filename = "mock-prompt-files/prompt.md";
  const metadata = {
    name: filename,
    type: "openResponse",
  };
  const result = metadataLogicalSchema(filename).safeParse(metadata);
  expect(result.success).toBe(true);
});

test("invalid: metadata name does not match filename", () => {
  const filename = "mock-prompt-files/prompt.md";
  const metadata = {
    name: "mock-prompt-files/WRONG.md",
    type: "openResponse",
  };
  const result = metadataLogicalSchema(filename).safeParse(metadata);
  if (!result.success) {
    console.log(result.error.issues);
  }
  expect(result.success).toBe(false);
});

