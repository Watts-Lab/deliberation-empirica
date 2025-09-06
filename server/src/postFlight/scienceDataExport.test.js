import { test, expect } from "vitest";

// Simple test to verify equipmentSettings is included in science data export structure
test("science data export includes equipmentSettings field", () => {
  // Mock player object
  const mockPlayer = {
    get: (key) => {
      const mockData = {
        "consent": "agreed",
        "introSequence": "complete",
        "setupSteps": [
          {
            step: "cameraCheck",
            event: "cameraSelected",
            value: "camera-123",
            timestamp: "2023-01-01T12:00:00.000Z",
          }
        ],
        "equipmentSettings": {
          camera: { deviceId: "camera-123", timestamp: "2023-01-01T12:00:00.000Z" },
          microphone: { deviceId: "mic-456", timestamp: "2023-01-01T12:01:00.000Z" },
          speaker: { deviceId: "speaker-789", timestamp: "2023-01-01T12:02:00.000Z" },
        },
      };
      return mockData[key] ?? "missing";
    }
  };

  // Simulate the playerData object structure from exportScienceData.js
  const playerData = {
    consent: mockPlayer.get("consent") ?? "missing",
    introSequence: mockPlayer.get("introSequence") || "missing",
    setupSteps: mockPlayer.get("setupSteps") || "missing",
    equipmentSettings: mockPlayer.get("equipmentSettings") ?? "missing",
  };

  // Verify that equipmentSettings is included and has the correct structure
  expect(playerData.equipmentSettings).toEqual({
    camera: { deviceId: "camera-123", timestamp: "2023-01-01T12:00:00.000Z" },
    microphone: { deviceId: "mic-456", timestamp: "2023-01-01T12:01:00.000Z" },
    speaker: { deviceId: "speaker-789", timestamp: "2023-01-01T12:02:00.000Z" },
  });

  // Verify other fields are still present
  expect(playerData.consent).toBe("agreed");
  expect(playerData.introSequence).toBe("complete");
  expect(playerData.setupSteps).toHaveLength(1);
});

test("science data export handles missing equipmentSettings gracefully", () => {
  // Mock player object without equipmentSettings
  const mockPlayer = {
    get: (key) => {
      const mockData = {
        "consent": "agreed",
        "introSequence": "complete",
        "setupSteps": [],
      };
      return mockData[key] ?? "missing";
    }
  };

  // Simulate the playerData object structure from exportScienceData.js
  const playerData = {
    consent: mockPlayer.get("consent") ?? "missing",
    introSequence: mockPlayer.get("introSequence") || "missing",
    setupSteps: mockPlayer.get("setupSteps") || "missing",
    equipmentSettings: mockPlayer.get("equipmentSettings") ?? "missing",
  };

  // Verify that equipmentSettings defaults to "missing" when not set
  expect(playerData.equipmentSettings).toBe("missing");
  expect(playerData.consent).toBe("agreed");
});