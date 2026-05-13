// Lifecycle-stage Sentry capture helpers. Each function in this
// module is the floor for one "no callback wraps me yet" exit point:
// boot-time bootstrap, env validation, process-level handlers. The
// richer batch-init / dispatcher-init captures in callbacks.js
// (added in #181) intentionally stay as-is — they carry batch-specific
// tags + contexts that a generic helper would flatten away.
//
// Why these live in their own module:
//   - `captureLifecycleError` is reused across index.js and
//     callbacks.js; co-locating the flush window + tag shape keeps
//     them in sync.
//   - `flushSentry` keeps index.js from directly importing
//     `@sentry/node` for the SIGTERM handler — all Sentry I/O funnels
//     through this module.
//   - `normalizeRejectionReason` is a pure utility that the
//     `unhandledRejection` handler depends on; extracting it makes
//     the non-Error coercion path unit-testable without spinning up
//     the process-level handler machinery.

import * as Sentry from "@sentry/node";

const FLUSH_TIMEOUT_MS = 2000;

export async function captureLifecycleError(err, { stage, contexts } = {}) {
  Sentry.captureException(err, {
    tags: {
      stage,
      runtimeImageTag: process.env.CONTAINER_IMAGE_VERSION_TAG,
    },
    ...(contexts ? { contexts } : {}),
  });
  await Sentry.flush(FLUSH_TIMEOUT_MS);
}

// Bounded flush for handlers that need to drain buffered events
// before the process exits but don't have an error of their own to
// capture (e.g. SIGTERM). Same window as `captureLifecycleError` so
// the two stay in lockstep when the flush budget changes.
export async function flushSentry() {
  await Sentry.flush(FLUSH_TIMEOUT_MS);
}

// `unhandledRejection` can fire with non-Error reasons (a thrown
// string, an awaited non-Error, etc.). Sentry's grouping + stack
// extraction expect an Error instance, so wrap once at the boundary.
// Pure function — extracted so the coercion path is unit-testable
// without driving the process-level handler.
export function normalizeRejectionReason(reason) {
  if (reason instanceof Error) return reason;
  return new Error(String(reason));
}
