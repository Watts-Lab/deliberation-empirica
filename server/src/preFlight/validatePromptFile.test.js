import { expect, test } from "vitest";
import {
  metadataTypeSchema,
  metadataRefineSchema,
  metadataLogicalSchema,
  validateSliderLabels,
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

// ----------- Slider Type Validation ------------

test("valid slider metadata with all required fields", () => {
  const metadata = {
    name: "mock-prompt-files/slider.md",
    type: "slider",
    min: 0,
    max: 100,
    interval: 1,
    labelPts: [0, 25, 50, 75, 100],
  };
  const result = metadataTypeSchema.safeParse(metadata);
  expect(result.success).toBe(true);
});

test("invalid: slider missing min field", () => {
  const metadata = {
    name: "mock-prompt-files/slider.md",
    type: "slider",
    max: 100,
    interval: 1,
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
  if (!result.success) {
    const minError = result.error.issues.find(issue => issue.path[0] === "min");
    expect(minError?.message).toBe("min is required for slider type");
  }
});

test("invalid: slider missing max field", () => {
  const metadata = {
    name: "mock-prompt-files/slider.md",
    type: "slider",
    min: 0,
    interval: 1,
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
  if (!result.success) {
    const maxError = result.error.issues.find(issue => issue.path[0] === "max");
    expect(maxError?.message).toBe("max is required for slider type");
  }
});

test("invalid: slider missing interval field", () => {
  const metadata = {
    name: "mock-prompt-files/slider.md",
    type: "slider",
    min: 0,
    max: 100,
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
  if (!result.success) {
    const intervalError = result.error.issues.find(issue => issue.path[0] === "interval");
    expect(intervalError?.message).toBe("interval is required for slider type");
  }
});

test("invalid: slider min >= max", () => {
  const metadata = {
    name: "mock-prompt-files/slider.md",
    type: "slider",
    min: 100,
    max: 100,
    interval: 1,
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
  if (!result.success) {
    const minError = result.error.issues.find(issue => issue.path[0] === "min");
    expect(minError?.message).toBe("min must be less than max");
  }
});

test("invalid: slider min + interval > max", () => {
  const metadata = {
    name: "mock-prompt-files/slider.md",
    type: "slider",
    min: 0,
    max: 10,
    interval: 20,
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
  if (!result.success) {
    const intervalError = result.error.issues.find(issue => issue.path[0] === "interval");
    expect(intervalError?.message).toBe("min + interval must be less than or equal to max");
  }
});

test("invalid: non-slider type with min field", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "openResponse",
    min: 0,
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
  if (!result.success) {
    const minError = result.error.issues.find(issue => issue.path[0] === "min");
    expect(minError?.message).toBe("min can only be specified for slider type");
  }
});

test("invalid: non-slider type with max field", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "openResponse",
    max: 100,
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
  if (!result.success) {
    const maxError = result.error.issues.find(issue => issue.path[0] === "max");
    expect(maxError?.message).toBe("max can only be specified for slider type");
  }
});

test("invalid: non-slider type with interval field", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "openResponse",
    interval: 1,
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
  if (!result.success) {
    const intervalError = result.error.issues.find(issue => issue.path[0] === "interval");
    expect(intervalError?.message).toBe("interval can only be specified for slider type");
  }
});

test("invalid: non-slider type with labelPts field", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "openResponse",
    labelPts: [0, 50, 100],
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
  if (!result.success) {
    const labelPtsError = result.error.issues.find(issue => issue.path[0] === "labelPts");
    expect(labelPtsError?.message).toBe("labelPts can only be specified for slider type");
  }
});

// ----------- Slider Label Validation ------------

test("valid: labelPts length matches number of labels", () => {
  const metadata = {
    name: "mock-prompt-files/slider.md",
    type: "slider",
    min: 0,
    max: 100,
    interval: 1,
    labelPts: [0, 25, 50, 75, 100],
  };
  const responseItems = ["Very cold", "Chilly", "Tolerable", "Warm", "Super Hot"];
  const issues = validateSliderLabels(metadata, responseItems);
  expect(issues.length).toBe(0);
});

test("invalid: labelPts length does not match number of labels", () => {
  const metadata = {
    name: "mock-prompt-files/slider.md",
    type: "slider",
    min: 0,
    max: 100,
    interval: 1,
    labelPts: [0, 50, 100],
  };
  const responseItems = ["Very cold", "Chilly", "Tolerable", "Warm", "Super Hot"];
  const issues = validateSliderLabels(metadata, responseItems);
  expect(issues.length).toBe(1);
  expect(issues[0].message).toContain("labelPts length (3) must match the number of labels (5)");
});

