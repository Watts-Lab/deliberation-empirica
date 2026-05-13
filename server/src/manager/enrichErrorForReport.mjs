/**
 * Axios-error enrichment for `reportTerminalError` + Sentry capture.
 *
 * Pulls METHOD / URL / status / response-body excerpt off axios-shaped
 * errors so the researcher dashboard sees more than `"Request failed
 * with status code 400"` and so the platform-team Sentry triage has
 * structured fields to filter on. Non-axios errors pass through with
 * their original message and no http context.
 *
 * Lives next to `reportTerminalError.mjs` in `manager/` because the
 * two are always called together at platform-error catch sites in
 * `callbacks.js`. Standalone module so it can be unit-tested without
 * pulling the full `callbacks.js` transitive dep tree (which imports
 * Empirica's classic-admin runtime and trips
 * `ERR_UNSUPPORTED_DIR_IMPORT` under vitest).
 *
 * Security notes:
 *
 *   - **URL credential scrub.** Etherpad puts its API key directly on
 *     the URL as `apikey=`; a raw URL capture would leak the key into
 *     the dashboard message AND Sentry AND the wire payload. Daily /
 *     Qualtrics put auth in headers (axios doesn't expose
 *     `err.response.config.headers` to us by default, and we don't
 *     read them here), so they're already safe. The scrub list is
 *     conservative — added defensively so any future provider that
 *     authenticates via query string gets the same redaction for free.
 *
 *   - **Body truncation.** Response body is capped at 2 KB for BOTH
 *     string-typed (Content-Type: text/html, plain-text errors from
 *     Etherpad / upstream proxies) and JSON-typed shapes. The earlier
 *     version of this code only truncated the JSON branch; a 50 KB
 *     HTML 502 page would have flowed through uncapped. Manager's
 *     `sanitizeReason` caps again on receipt.
 */

// Query-param names that may carry a credential.
const SENSITIVE_QUERY_PARAMS = new Set([
  "apikey",
  "api_key",
  "token",
  "access_token",
  "auth_token",
  "key",
  "secret",
  "password",
  "pw",
]);

const MAX_BODY_BYTES = 2000;

/**
 * Strip credential-bearing query params from a URL. Replaces sensitive
 * values with `[REDACTED]` (URL-encoded to `%5BREDACTED%5D` per the
 * WHATWG URL spec) so reviewers can still see which param was set
 * (vs. silently dropping it, which would make URLs ambiguous). Falls
 * through on parse failure — shipping a non-redacted URL on a
 * malformed input is preferable to dropping the diagnostic info.
 */
export function scrubUrl(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.length === 0) return "(unknown url)";
  try {
    const u = new URL(rawUrl);
    // `Array.from(searchParams.keys())` snapshot before mutation —
    // calling `.set()` while iterating would otherwise risk skipping
    // entries (and the repo lint rule forbids `for..of` here anyway).
    Array.from(u.searchParams.keys()).forEach((k) => {
      if (SENSITIVE_QUERY_PARAMS.has(k.toLowerCase())) {
        u.searchParams.set(k, "[REDACTED]");
      }
    });
    return u.toString();
  } catch {
    return rawUrl;
  }
}

/**
 * Return `{message, httpContext?}` for use by `reportTerminalError`
 * and `Sentry.captureException`. See module header.
 */
export function enrichErrorForReport(err) {
  const baseMessage = err?.message ?? String(err);
  if (!err?.isAxiosError || !err?.response) {
    return { message: baseMessage };
  }
  const { status, data, config } = err.response;
  const method = (config?.method ?? "request").toUpperCase();
  const url = scrubUrl(config?.url);
  const rawBody = typeof data === "string" ? data : JSON.stringify(data ?? "");
  const bodyText = (rawBody ?? "").slice(0, MAX_BODY_BYTES);
  return {
    message: `${baseMessage} (${method} ${url} → ${status}: ${bodyText})`,
    httpContext: {
      method,
      url,
      status,
      body: bodyText,
    },
  };
}
