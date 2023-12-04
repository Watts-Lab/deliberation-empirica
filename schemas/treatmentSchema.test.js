/* eslint-disable no-restricted-syntax */
import { treatmentSchema } from "./treatmentSchema";
import { load as loadYaml } from "js-yaml";
import fs from "fs";

// todo: import the test treatment from cypress and check that everything
// in there passes the validation

describe("treatmentSchema", () => {
  it("successfully parses treatments from the test suite", () => {
    const testTreatments = loadYaml(
      fs.readFileSync(
        "../cypress/fixtures/mockCDN/projects/example/treatments.test.yaml",
        "utf8"
      )
    );
    for (const treatment of testTreatments.treatments) {
      expect(() => treatmentSchema.parse(treatment)).not.toThrow();
    }
  });
  it("validates correctly for valid data", () => {
    const validTreatment = {
      name: "Test Treatment",
      playerCount: 2,
      gameStages: [
        {
          name: "stage1",
          duration: 10,
          elements: [
            { type: "prompt", file: "projects/css_lab/5min_warning.md" },
            { type: "prompt", file: "projects/css_lab/5min_warning.md" },
          ],
        },
      ],
    };

    expect(() => treatmentSchema.parse(validTreatment)).not.toThrow();
  });

  it("throws error if displayTime is larger than duration", () => {
    const invalidTreatment = {
      name: "Test Treatment",
      playerCount: 2,
      gameStages: [
        {
          name: "stage1",
          duration: 10,
          elements: [
            {
              type: "prompt",
              file: "projects/example/noResponse.md",
              displayTime: 20,
            },
          ],
        },
      ],
    };

    expect(() => treatmentSchema.parse(invalidTreatment)).toThrow();
  });

  it("throws error if hideTime is larger than duration", () => {
    const invalidTreatment = {
      name: "Test Treatment",
      playerCount: 2,
      gameStages: [
        {
          name: "stage1",
          duration: 10,
          elements: [
            {
              type: "prompt",
              file: "projects/example/noResponse.md",
              hideTime: 20,
            },
          ],
        },
      ],
    };

    expect(() => treatmentSchema.parse(invalidTreatment)).toThrow();
  });

  it("validates correctly for invalid data", () => {
    const invalidData = {
      name: "Test Treatment",
      playerCount: "two", // playerCount should be a number
    };

    const result = treatmentSchema.safeParse(invalidData);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// TODO:
// - showToPositions and hideFromPositions should all be less than the number of players
// - condition "positions" should all be less than the number of players
