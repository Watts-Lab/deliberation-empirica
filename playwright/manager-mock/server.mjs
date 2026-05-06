// Node http server that implements the manager side of the
// runtime↔manager tick contract. Symmetric to manager/tools/mock-
// runtime/src/server.ts (which implements the runtime side); together
// they let either repo's contract surface be exercised in isolation.
//
// Routes:
//
//   POST /api/instances/:id/tick — the contract surface. JWT-validates
//     the Authorization header, payload-validates against
//     contracts/tick.mjs, records the tick on state, and responds with
//     the next canned response (or default ack). 401 on missing/bad
//     JWT; 422 on payload schema failure.
//
//   POST /control/enqueueAck       — script the next reply
//   POST /control/enqueueRetry     — script the next reply (retryable)
//   POST /control/enqueueDiscard   — script the next reply (non-retryable)
//   GET  /control/received         — list captured ticks
//   POST /control/reset            — clear captured + canned state
//
// The /control/* surface is a footgun in any non-test context. This
// harness lives under playwright/ and ships as test infra only — never
// expose it to a non-test process.

import { createServer } from "node:http";
// Relative imports — playwright/ has no node_modules of its own and
// the contracts package alias is registered only on server/. Same
// convention as the existing _helpers (e.g. empiricaAdminAPI.mjs).
import { tickPayload } from "../../contracts/tick.mjs";
import {
  decodeAndValidateClaims,
  verifyManagerToken,
} from "../../server/src/manager/jwtVerifier.mjs";

const TICK_PATH_RE = /^\/api\/instances\/([^/]+)\/tick$/;

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (text.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function extractBearer(req) {
  const auth = req.headers.authorization || "";
  const match = auth.match(/^Bearer\s+(.+)$/);
  return match ? match[1] : null;
}

// Build an http.Server that handles the routes above. Caller owns
// the lifecycle (`listen`, `close`).
//
// Options:
//   - state: a ManagerMockState instance (required).
//   - jwtVerify: how to validate the per-tick Authorization header.
//       "decode-only" (default) — decode + claims-validate against
//                                 contracts/jwt.mjs + check exp + check
//                                 kid. No signature verification.
//                                 Useful when the test mints tokens
//                                 in-process and doesn't want to thread
//                                 a signing key through fixtures.
//       "hs256"        — full HS256 signature verification per
//                        manager ADR 0010. `secret` option must be
//                        provided. Enforces alg-confusion defense
//                        (rejects `alg: "none"` and non-HS256 algs)
//                        before HMAC-comparing.
//       "verify"       — alias for "hs256" now that
//                        deliberation-lab#109 has landed. Kept as a
//                        name so callers that selected "verify"
//                        before #109 (when it meant decode+claims+exp)
//                        still resolve, but now requires `secret`.
//       "skip"         — accept any non-empty token; useful when the
//                        test isn't focused on the JWT path.
//   - secret: required when `jwtVerify: "hs256"`. May be a Buffer or
//       a base64-encoded string (manager injects base64 per ADR 0010).
//   - expectedInstanceId: when set, also assert the path's :id matches
//       the JWT's instance_id and 401 otherwise. Catches the runtime
//       posting to a different instance's URL than its token claims.
//   - logger: optional `{info, warn}` for diagnostic output.
export function buildServer({
  state,
  jwtVerify = "decode-only",
  secret,
  expectedInstanceId,
  logger = null,
}) {
  if (!state) throw new Error("buildServer: state is required");
  if ((jwtVerify === "hs256" || jwtVerify === "verify") && !secret) {
    throw new Error(
      `buildServer: jwtVerify="${jwtVerify}" requires \`secret\``,
    );
  }

  const handler = async (req, res) => {
    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    } catch {
      send(res, 400, { error: "invalid URL" });
      return;
    }

    // POST /api/instances/:id/tick
    const tickMatch = url.pathname.match(TICK_PATH_RE);
    if (req.method === "POST" && tickMatch) {
      const pathInstanceId = tickMatch[1];
      const token = extractBearer(req);
      if (!token) {
        send(res, 401, {
          ok: false,
          retryable: false,
          code: "MISSING_AUTHORIZATION",
        });
        return;
      }
      let claims;
      try {
        if (jwtVerify === "skip") {
          // Accept any non-empty token without validation.
          claims = { instance_id: pathInstanceId };
        } else if (jwtVerify === "hs256" || jwtVerify === "verify") {
          // Full HS256 verification. Use the runtime's verifier so
          // the manager mock and the runtime stay in lockstep —
          // anything one side accepts the other side accepts, and
          // vice versa. Pass `secret` explicitly so the harness
          // doesn't depend on JWT_VERIFY_SECRET being set in the
          // test process's env.
          claims = verifyManagerToken(token, { secret });
        } else {
          // `decode-only` — claims schema + kid + exp, no signature.
          // Used by tests that mint unsigned tokens in-process.
          claims = decodeAndValidateClaims(token);
        }
      } catch (e) {
        send(res, 401, {
          ok: false,
          retryable: false,
          code: "INVALID_JWT",
          message: e.message,
        });
        return;
      }
      if (
        expectedInstanceId !== undefined &&
        claims.instance_id !== expectedInstanceId
      ) {
        send(res, 401, {
          ok: false,
          retryable: false,
          code: "INSTANCE_ID_MISMATCH",
          message: `JWT instance_id "${claims.instance_id}" does not match harness's expectedInstanceId "${expectedInstanceId}"`,
        });
        return;
      }
      if (claims.instance_id !== pathInstanceId) {
        send(res, 401, {
          ok: false,
          retryable: false,
          code: "PATH_TOKEN_MISMATCH",
          message: `JWT instance_id "${claims.instance_id}" does not match path "${pathInstanceId}"`,
        });
        return;
      }
      let body;
      try {
        body = await readBody(req);
      } catch (e) {
        send(res, 400, {
          ok: false,
          retryable: false,
          code: "INVALID_JSON",
          message: e.message,
        });
        return;
      }
      const parsed = tickPayload.safeParse(body);
      if (!parsed.success) {
        send(res, 422, {
          ok: false,
          retryable: false,
          code: "INVALID_TICK_PAYLOAD",
          issues: parsed.error.issues,
        });
        return;
      }
      const reply = state.recordAndReply(parsed.data, token);
      logger?.info?.(
        {
          instanceId: pathInstanceId,
          sequence: parsed.data.sequence,
          status: parsed.data.status,
          replyStatus: reply.status,
        },
        "manager-mock: tick received",
      );
      send(res, reply.status ?? 200, reply.body);
      return;
    }

    // Helper: parse the control-endpoint JSON body strictly. Returns
    // null and writes a 400 if the body isn't valid JSON. Strictness
    // (vs the previous `.catch(() => ({}))`) catches test bugs where
    // the caller sent malformed JSON expecting it to enqueue a
    // default — that silent fallthrough hides the fact that the
    // intended payload never reached the harness.
    const parseControlBody = async () => {
      try {
        return await readBody(req);
      } catch (e) {
        send(res, 400, {
          ok: false,
          code: "INVALID_JSON",
          message: e.message,
        });
        return null;
      }
    };

    // POST /control/enqueueAck
    if (req.method === "POST" && url.pathname === "/control/enqueueAck") {
      const body = await parseControlBody();
      if (body === null) return;
      try {
        state.enqueueAck(body);
      } catch (e) {
        send(res, 400, { ok: false, code: "INVALID_ACK", message: e.message });
        return;
      }
      send(res, 200, { ok: true });
      return;
    }

    // POST /control/enqueueRetry
    if (req.method === "POST" && url.pathname === "/control/enqueueRetry") {
      const body = await parseControlBody();
      if (body === null) return;
      state.enqueueRetry(body);
      send(res, 200, { ok: true });
      return;
    }

    // POST /control/enqueueDiscard
    if (req.method === "POST" && url.pathname === "/control/enqueueDiscard") {
      const body = await parseControlBody();
      if (body === null) return;
      state.enqueueDiscard(body);
      send(res, 200, { ok: true });
      return;
    }

    // GET /control/received
    if (req.method === "GET" && url.pathname === "/control/received") {
      send(res, 200, { ticks: state.received() });
      return;
    }

    // POST /control/reset
    if (req.method === "POST" && url.pathname === "/control/reset") {
      state.reset();
      send(res, 200, { ok: true });
      return;
    }

    send(res, 404, { error: `no handler for ${req.method} ${url.pathname}` });
  };

  return createServer((req, res) => {
    handler(req, res).catch((err) => {
      logger?.warn?.(
        { err: err?.message ?? err },
        "manager-mock: handler threw",
      );
      try {
        send(res, 500, {
          ok: false,
          retryable: false,
          code: "HANDLER_ERROR",
          message: err?.message ?? String(err),
        });
      } catch {
        // response may already be in flight
      }
    });
  });
}
