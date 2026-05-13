import { describe, it, expect } from "vitest";
import { enrichErrorForReport } from "./enrichErrorForReport.mjs";

/**
 * Unit tests for the axios-error enrichment helper in
 * `server/src/callbacks.js`. The catch-block call sites aren't
 * directly exercisable without a full runtime harness; this file
 * exists so the helper's edge cases (URL scrubbing, body
 * truncation, non-axios passthrough) are pinned independently.
 *
 * The helper is the only piece of the manager-runtime-observability
 * change set (PR #181) that runs synchronously on every platform-
 * error catch — getting it wrong leaks creds or bloats the tick
 * payload, both observably.
 */

function makeAxiosError({ method = "post", url, status, data, message }) {
  const err = new Error(message ?? `Request failed with status code ${status}`);
  err.isAxiosError = true;
  err.response = {
    status,
    data,
    config: { method, url },
  };
  return err;
}

describe("enrichErrorForReport — non-axios passthrough", () => {
  it("returns the bare message for a plain Error (no httpContext)", () => {
    const result = enrichErrorForReport(new Error("Something broke"));
    expect(result.message).toBe("Something broke");
    expect(result.httpContext).toBeUndefined();
  });

  it("returns the bare message for an axios error with no .response (e.g. ECONNREFUSED)", () => {
    // axios sets isAxiosError but no response when the request never
    // got an HTTP reply (DNS failure, connection refused, etc.).
    const err = new Error("connect ECONNREFUSED 127.0.0.1:80");
    err.isAxiosError = true;
    const result = enrichErrorForReport(err);
    expect(result.message).toBe("connect ECONNREFUSED 127.0.0.1:80");
    expect(result.httpContext).toBeUndefined();
  });

  it("handles a null/undefined error without crashing", () => {
    expect(enrichErrorForReport(null).message).toBeDefined();
    expect(enrichErrorForReport(undefined).message).toBeDefined();
  });
});

describe("enrichErrorForReport — URL credential scrubbing", () => {
  it("redacts apikey= query param (Etherpad pattern)", () => {
    // Etherpad's provider puts `apikey=` directly on the URL —
    // server/src/providers/etherpad.js. Without scrubbing, the key
    // would land in the dashboard message + Sentry + the wire
    // payload. Same for token / access_token / key etc.
    const err = makeAxiosError({
      method: "post",
      url: "https://etherpad.example.com/api/1.2.13/createPad?apikey=SUPERSECRET&padID=p1",
      status: 500,
      data: "boom",
    });
    const result = enrichErrorForReport(err);
    expect(result.httpContext.url).toContain("apikey=%5BREDACTED%5D");
    expect(result.httpContext.url).not.toContain("SUPERSECRET");
    expect(result.httpContext.url).toContain("padID=p1");
    expect(result.message).not.toContain("SUPERSECRET");
    expect(result.message).toContain("apikey=%5BREDACTED%5D");
  });

  it("redacts multiple credential-shaped params", () => {
    const err = makeAxiosError({
      method: "get",
      url: "https://api.example.com/x?token=AAA&secret=BBB&user=alice",
      status: 401,
      data: { error: "unauthorized" },
    });
    const {url} = enrichErrorForReport(err).httpContext;
    expect(url).not.toMatch(/AAA|BBB/);
    expect(url).toContain("user=alice");
  });

  it("falls through on malformed URL — non-redacted but not crashed", () => {
    // `new URL` throws on unparseable input. Better to ship a
    // diagnostic URL untouched than lose the diagnostic info.
    const err = makeAxiosError({
      method: "post",
      url: "not a url at all",
      status: 400,
      data: "boom",
    });
    expect(() => enrichErrorForReport(err)).not.toThrow();
    expect(enrichErrorForReport(err).httpContext.url).toBe("not a url at all");
  });

  it("uses '(unknown url)' when axios captured no URL", () => {
    const err = new Error("Request failed with status code 502");
    err.isAxiosError = true;
    err.response = { status: 502, data: "Bad Gateway", config: {} };
    expect(enrichErrorForReport(err).httpContext.url).toBe("(unknown url)");
  });
});

describe("enrichErrorForReport — body truncation", () => {
  it("truncates a long STRING response body at 2 KB (the bug the reviewer caught)", () => {
    // A provider that returns Content-Type: text/html (an upstream
    // proxy's HTML 502 page, Qualtrics's occasional HTML, etc.)
    // would land here. Pre-fix, the `.slice(0, 2000)` only applied
    // in the JSON.stringify branch — string bodies flowed through
    // uncapped and bloated the wire payload.
    const longString = "x".repeat(5000);
    const err = makeAxiosError({
      method: "get",
      url: "https://x.test/y",
      status: 502,
      data: longString,
    });
    const { httpContext, message } = enrichErrorForReport(err);
    expect(httpContext.body.length).toBe(2000);
    // Message should also be bounded (status+url+body ≪ 5 KB).
    expect(message.length).toBeLessThan(2500);
  });

  it("truncates a deep JSON response body at 2 KB", () => {
    const data = {
      items: Array.from({ length: 500 }, (_, i) => ({ id: i, val: "stuff" })),
    };
    const err = makeAxiosError({
      method: "post",
      url: "https://x.test/y",
      status: 400,
      data,
    });
    const { httpContext } = enrichErrorForReport(err);
    expect(httpContext.body.length).toBe(2000);
  });

  it("passes short bodies through verbatim", () => {
    const err = makeAxiosError({
      method: "post",
      url: "https://api.daily.co/v1/rooms",
      status: 400,
      data: { error: "unable to upload test file to bucket" },
    });
    const { httpContext, message } = enrichErrorForReport(err);
    expect(httpContext.body).toContain("unable to upload test file");
    expect(message).toContain("unable to upload test file");
    expect(message).toContain("https://api.daily.co/v1/rooms");
    expect(message).toContain("400");
    expect(message).toContain("POST");
  });
});
