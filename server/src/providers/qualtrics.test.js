import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Mock axios *before* importing the SUT so the import binding sees the mock.
// Mirrors dailyco.test.js — env-aware code paths read process.env at call
// time, so we mutate keys in beforeEach rather than at module-eval time.
vi.mock("axios", () => ({
  get: vi.fn(),
  default: {
    get: vi.fn(),
  },
}));

// eslint-disable-next-line import/first
import { get } from "axios";
// eslint-disable-next-line import/first
import { getQualtricsData } from "./qualtrics";

let envSnapshot;

beforeEach(() => {
  vi.resetAllMocks();
  envSnapshot = { ...process.env };
  process.env.QUALTRICS_DATACENTER = "iad1";
  process.env.QUALTRICS_API_TOKEN = "test-token";
  delete process.env.QUALTRICS_API_BASE_URL;
});

afterEach(() => {
  Object.keys(process.env).forEach((key) => {
    delete process.env[key];
  });
  Object.assign(process.env, envSnapshot);
});

describe("getQualtricsData — base URL resolution", () => {
  test("default: hits the real datacenter host when QUALTRICS_API_BASE_URL is unset", async () => {
    get.mockResolvedValueOnce({
      status: 200,
      data: { result: { values: { progress: 100 } } },
    });

    await getQualtricsData({ surveyId: "SV_x", sessionId: "FS_y" });

    expect(get).toHaveBeenCalledTimes(1);
    const calledURL = get.mock.calls[0][0];
    expect(calledURL).toBe(
      "https://iad1.qualtrics.com/API/v3/surveys/SV_x/responses/R_y",
    );
  });

  test("override: hits QUALTRICS_API_BASE_URL when set (mock-server pattern)", async () => {
    process.env.QUALTRICS_API_BASE_URL = "http://127.0.0.1:9200/qualtrics";
    get.mockResolvedValueOnce({
      status: 200,
      data: { result: { values: { progress: 100 } } },
    });

    await getQualtricsData({ surveyId: "SV_x", sessionId: "FS_y" });

    expect(get).toHaveBeenCalledTimes(1);
    const calledURL = get.mock.calls[0][0];
    expect(calledURL).toBe(
      "http://127.0.0.1:9200/qualtrics/API/v3/surveys/SV_x/responses/R_y",
    );
  });

  test("sessionId FS_ prefix becomes R_ in the responseId path segment", async () => {
    get.mockResolvedValueOnce({
      status: 200,
      data: { result: { values: {} } },
    });

    await getQualtricsData({
      surveyId: "SV_test",
      sessionId: "FS_abcdef123",
    });

    const calledURL = get.mock.calls[0][0];
    expect(calledURL).toMatch(/\/responses\/R_abcdef123$/);
  });
});

describe("getQualtricsData — auth header", () => {
  test("sends X-API-TOKEN with the trimmed token value", async () => {
    process.env.QUALTRICS_API_TOKEN = "  whitespace-padded-token  ";
    get.mockResolvedValueOnce({
      status: 200,
      data: { result: { values: {} } },
    });

    await getQualtricsData({ surveyId: "SV_x", sessionId: "FS_y" });

    const config = get.mock.calls[0][1];
    expect(config.headers["X-API-TOKEN"]).toBe("whitespace-padded-token");
    expect(config.headers["Content-Type"]).toBe("application/json");
  });
});
