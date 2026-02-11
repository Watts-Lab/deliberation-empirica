import { describe, it, expect } from "vitest";
import {
  findMatchingDevice,
  needsAlignment,
  getAlignmentStatus,
} from "./deviceAlignment";

// Mock device data matching Daily.co's useDevices() structure
const mockDevices = [
  { device: { deviceId: "device-1", label: "MacBook Pro Microphone" } },
  { device: { deviceId: "device-2", label: "AirPods Pro" } },
  { device: { deviceId: "device-3", label: "External USB Mic" } },
];

describe("findMatchingDevice", () => {
  describe("ID matching (Strategy 1)", () => {
    it("returns exact ID match when available", () => {
      const result = findMatchingDevice(
        mockDevices,
        "device-2",
        "AirPods Pro"
      );
      expect(result).not.toBeNull();
      expect(result.device.device.deviceId).toBe("device-2");
      expect(result.matchType).toBe("id");
    });

    it("prioritizes ID match over label match", () => {
      // Device 1 has matching ID, device 2 has matching label
      const result = findMatchingDevice(
        mockDevices,
        "device-1",
        "AirPods Pro"
      );
      expect(result.device.device.deviceId).toBe("device-1");
      expect(result.matchType).toBe("id");
    });
  });

  describe("Label matching (Strategy 2 - Safari workaround)", () => {
    it("falls back to label match when ID not found", () => {
      const result = findMatchingDevice(
        mockDevices,
        "rotated-safari-id", // Safari rotated the ID
        "AirPods Pro"
      );
      expect(result).not.toBeNull();
      expect(result.device.device.label).toBe("AirPods Pro");
      expect(result.matchType).toBe("label");
    });

    it("handles case where label is also not found", () => {
      const result = findMatchingDevice(
        mockDevices,
        "unknown-id",
        "Unknown Device"
      );
      expect(result.matchType).toBe("fallback");
    });
  });

  describe("Fallback (Strategy 3)", () => {
    it("returns first device when neither ID nor label match", () => {
      const result = findMatchingDevice(
        mockDevices,
        "unknown-id",
        "Unknown Label"
      );
      expect(result).not.toBeNull();
      expect(result.device.device.deviceId).toBe("device-1");
      expect(result.matchType).toBe("fallback");
    });

    it("returns first device when preferredLabel is null", () => {
      const result = findMatchingDevice(mockDevices, "unknown-id", null);
      expect(result.matchType).toBe("fallback");
      expect(result.device.device.deviceId).toBe("device-1");
    });
  });

  describe("Edge cases", () => {
    it("returns null when devices array is empty", () => {
      const result = findMatchingDevice([], "device-1", "Label");
      expect(result).toBeNull();
    });

    it("returns null when devices is null", () => {
      const result = findMatchingDevice(null, "device-1", "Label");
      expect(result).toBeNull();
    });

    it("returns null when devices is undefined", () => {
      const result = findMatchingDevice(undefined, "device-1", "Label");
      expect(result).toBeNull();
    });

    it("handles devices with missing labels gracefully", () => {
      const devicesWithMissingLabels = [
        { device: { deviceId: "device-1", label: undefined } },
        { device: { deviceId: "device-2", label: "Valid Label" } },
      ];
      const result = findMatchingDevice(
        devicesWithMissingLabels,
        "unknown",
        "Valid Label"
      );
      expect(result.device.device.label).toBe("Valid Label");
      expect(result.matchType).toBe("label");
    });

    it("handles multiple devices with same label (first match wins)", () => {
      const duplicateLabels = [
        { device: { deviceId: "device-1", label: "Same Label" } },
        { device: { deviceId: "device-2", label: "Same Label" } },
      ];
      const result = findMatchingDevice(duplicateLabels, "unknown", "Same Label");
      expect(result.device.device.deviceId).toBe("device-1");
      expect(result.matchType).toBe("label");
    });
  });
});

describe("needsAlignment", () => {
  it("returns true when current device differs from target", () => {
    const currentDevice = { device: { deviceId: "current-id" } };
    expect(needsAlignment(currentDevice, "different-id")).toBe(true);
  });

  it("returns false when current device matches target", () => {
    const currentDevice = { device: { deviceId: "same-id" } };
    expect(needsAlignment(currentDevice, "same-id")).toBe(false);
  });

  it("returns true when current device is null", () => {
    expect(needsAlignment(null, "target-id")).toBe(true);
  });

  it("returns true when current device has no deviceId", () => {
    const currentDevice = { device: {} };
    expect(needsAlignment(currentDevice, "target-id")).toBe(true);
  });

  it("returns false when both are undefined (edge case)", () => {
    expect(needsAlignment(undefined, undefined)).toBe(false);
  });
});

describe("getAlignmentStatus", () => {
  it("reports matched by ID when IDs match", () => {
    const status = getAlignmentStatus(
      "device-1",
      "Label",
      "device-1",
      "Different Label"
    );
    expect(status.matchedById).toBe(true);
    expect(status.matchedByLabel).toBe(false);
  });

  it("reports matched by label when labels match", () => {
    const status = getAlignmentStatus(
      "device-1",
      "Same Label",
      "device-2",
      "Same Label"
    );
    expect(status.matchedById).toBe(false);
    expect(status.matchedByLabel).toBe(true);
  });

  it("reports both matched when both match", () => {
    const status = getAlignmentStatus(
      "device-1",
      "Same Label",
      "device-1",
      "Same Label"
    );
    expect(status.matchedById).toBe(true);
    expect(status.matchedByLabel).toBe(true);
  });

  it("reports null for match status when values are missing", () => {
    const status = getAlignmentStatus(null, null, "device-1", "Label");
    expect(status.matchedById).toBeNull();
    expect(status.matchedByLabel).toBeNull();
  });

  it("preserves all input values in output", () => {
    const status = getAlignmentStatus(
      "pref-id",
      "Pref Label",
      "curr-id",
      "Curr Label"
    );
    expect(status.preferredId).toBe("pref-id");
    expect(status.preferredLabel).toBe("Pref Label");
    expect(status.currentId).toBe("curr-id");
    expect(status.currentLabel).toBe("Curr Label");
  });
});
