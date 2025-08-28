import { test, expect } from "vitest";

// Function to extract equipment settings from setup steps (extracted from EquipmentCheck.jsx logic)
function extractEquipmentSettings(setupSteps) {
  const equipmentSettings = {
    camera: null,
    microphone: null,
    speaker: null,
  };

  // Extract the last selected devices from setup steps
  setupSteps.forEach((step) => {
    if (step.event === "cameraSelected" && step.value) {
      equipmentSettings.camera = {
        deviceId: step.value,
        timestamp: step.timestamp,
      };
    } else if (step.event === "selectMicrophone" && step.value) {
      equipmentSettings.microphone = {
        deviceId: step.value,
        timestamp: step.timestamp,
      };
    } else if (step.event === "selectSpeaker" && step.value) {
      equipmentSettings.speaker = {
        deviceId: step.value,
        timestamp: step.timestamp,
      };
    }
  });

  return equipmentSettings;
}

test("extracts camera equipment settings correctly", () => {
  const setupSteps = [
    {
      step: "cameraCheck",
      event: "cameraSelected",
      value: "camera-device-123",
      timestamp: "2023-01-01T12:00:00.000Z",
    },
  ];

  const result = extractEquipmentSettings(setupSteps);
  
  expect(result.camera).toEqual({
    deviceId: "camera-device-123",
    timestamp: "2023-01-01T12:00:00.000Z",
  });
  expect(result.microphone).toBeNull();
  expect(result.speaker).toBeNull();
});

test("extracts microphone equipment settings correctly", () => {
  const setupSteps = [
    {
      step: "micCheck",
      event: "selectMicrophone",
      value: "mic-device-456",
      timestamp: "2023-01-01T12:01:00.000Z",
    },
  ];

  const result = extractEquipmentSettings(setupSteps);
  
  expect(result.microphone).toEqual({
    deviceId: "mic-device-456",
    timestamp: "2023-01-01T12:01:00.000Z",
  });
  expect(result.camera).toBeNull();
  expect(result.speaker).toBeNull();
});

test("extracts speaker equipment settings correctly", () => {
  const setupSteps = [
    {
      step: "headphonesCheck",
      event: "selectSpeaker",
      value: "speaker-device-789",
      timestamp: "2023-01-01T12:02:00.000Z",
    },
  ];

  const result = extractEquipmentSettings(setupSteps);
  
  expect(result.speaker).toEqual({
    deviceId: "speaker-device-789",
    timestamp: "2023-01-01T12:02:00.000Z",
  });
  expect(result.camera).toBeNull();
  expect(result.microphone).toBeNull();
});

test("extracts all equipment settings from mixed setup steps", () => {
  const setupSteps = [
    {
      step: "cameraCheck",
      event: "startVideo",
      value: "started",
      timestamp: "2023-01-01T11:59:00.000Z",
    },
    {
      step: "cameraCheck",
      event: "cameraSelected",
      value: "camera-device-123",
      timestamp: "2023-01-01T12:00:00.000Z",
    },
    {
      step: "micCheck",
      event: "selectMicrophone",
      value: "mic-device-456",
      timestamp: "2023-01-01T12:01:00.000Z",
    },
    {
      step: "headphonesCheck",
      event: "selectSpeaker",
      value: "speaker-device-789",
      timestamp: "2023-01-01T12:02:00.000Z",
    },
    {
      step: "equipmentCheck",
      event: "complete",
      timestamp: "2023-01-01T12:03:00.000Z",
    },
  ];

  const result = extractEquipmentSettings(setupSteps);
  
  expect(result.camera).toEqual({
    deviceId: "camera-device-123",
    timestamp: "2023-01-01T12:00:00.000Z",
  });
  expect(result.microphone).toEqual({
    deviceId: "mic-device-456",
    timestamp: "2023-01-01T12:01:00.000Z",
  });
  expect(result.speaker).toEqual({
    deviceId: "speaker-device-789",
    timestamp: "2023-01-01T12:02:00.000Z",
  });
});

test("uses last selected device when multiple selections occur", () => {
  const setupSteps = [
    {
      step: "cameraCheck",
      event: "cameraSelected",
      value: "camera-device-old",
      timestamp: "2023-01-01T12:00:00.000Z",
    },
    {
      step: "cameraCheck",
      event: "cameraSelected",
      value: "camera-device-new",
      timestamp: "2023-01-01T12:01:00.000Z",
    },
  ];

  const result = extractEquipmentSettings(setupSteps);
  
  expect(result.camera).toEqual({
    deviceId: "camera-device-new",
    timestamp: "2023-01-01T12:01:00.000Z",
  });
});

test("ignores steps without values", () => {
  const setupSteps = [
    {
      step: "cameraCheck",
      event: "cameraSelected",
      value: "",
      timestamp: "2023-01-01T12:00:00.000Z",
    },
    {
      step: "micCheck",
      event: "selectMicrophone",
      value: null,
      timestamp: "2023-01-01T12:01:00.000Z",
    },
  ];

  const result = extractEquipmentSettings(setupSteps);
  
  expect(result.camera).toBeNull();
  expect(result.microphone).toBeNull();
  expect(result.speaker).toBeNull();
});