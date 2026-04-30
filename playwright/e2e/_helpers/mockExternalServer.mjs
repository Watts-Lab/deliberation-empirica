import { createServer } from "http";
import { URL } from "url";

// In-process HTTP mock for external services the server talks to (GitHub,
// Daily.co, Qualtrics, Etherpad, S3, ...). One server per worker; each
// provider's handlers are routed internally by path.
//
// Design principle: handlers are built to match each provider's public API
// contract (per their REST docs), NOT mirrored from what our code happens
// to send. If our code sends the wrong shape, the mock rejects it the same
// way the real API would. This gives us an independent conformance check,
// not a tautology.
//
// Every request is appended to `recorded`. Tests read that array directly
// (same Node process) and assert on what was called.

// ---------------------------------------------------------------------------
// GitHub REST v3 handlers — API spec: https://docs.github.com/en/rest
// ---------------------------------------------------------------------------

const GITHUB_PATH_PATTERNS = [
  // GET /rate_limit
  {
    method: "GET",
    regex: /^\/rate_limit$/,
    handle() {
      return json(200, {
        rate: {
          limit: 5000,
          remaining: 4999,
          reset: Math.floor(Date.now() / 1000) + 3600,
          used: 1,
        },
        resources: {
          core: {
            limit: 5000,
            remaining: 4999,
            reset: Math.floor(Date.now() / 1000) + 3600,
            used: 1,
          },
        },
      });
    },
  },

  // GET /repos/{owner}/{repo}/git/ref/{ref}
  // Per GitHub docs, `ref` is the full reference (e.g. "heads/main").
  // Octokit URL-encodes the slash, so the path arrives as
  // "/git/ref/heads%2Fmain". Match the whole remaining string; decode
  // before use.
  {
    method: "GET",
    regex: /^\/repos\/([^/]+)\/([^/]+)\/git\/ref\/(.+)$/,
    handle(req, match) {
      const ref = decodeURIComponent(match[3]);
      return json(200, {
        ref: `refs/${ref}`,
        node_id: "MDM6UmVmMTE6bW9jayE=",
        url: `${req.mockBaseUrl}/repos/${match[1]}/${match[2]}/git/refs/${ref}`,
        object: {
          sha: "0000000000000000000000000000000000000001",
          type: "commit",
          url: `${req.mockBaseUrl}/repos/${match[1]}/${match[2]}/git/commits/0000000000000000000000000000000000000001`,
        },
      });
    },
  },

  // GET /repos/{owner}/{repo}/contents/{path}
  // Per GitHub docs: 200 if the file exists (returns metadata incl. `sha`);
  // 404 if it doesn't. Our provider uses this to decide whether a PUT is
  // create-vs-update.
  {
    method: "GET",
    regex: /^\/repos\/([^/]+)\/([^/]+)\/contents\/(.+)$/,
    handle(req, match, state) {
      const key = `${match[1]}/${match[2]}/${decodeURIComponent(match[3])}`;
      const existing = state.githubFiles.get(key);
      if (!existing) {
        return json(404, {
          message: "Not Found",
          documentation_url:
            "https://docs.github.com/rest/repos/contents#get-repository-content",
        });
      }
      return json(200, {
        type: "file",
        encoding: "base64",
        size: existing.content.length,
        name: match[3].split("/").pop(),
        path: decodeURIComponent(match[3]),
        content: existing.content,
        sha: existing.sha,
        url: `${req.mockBaseUrl}${req.url}`,
        git_url: `${req.mockBaseUrl}/repos/${match[1]}/${match[2]}/git/blobs/${existing.sha}`,
        html_url: `https://github.com/${match[1]}/${match[2]}/blob/main/${match[3]}`,
        download_url: `${req.mockBaseUrl}/raw/${match[1]}/${match[2]}/main/${match[3]}`,
      });
    },
  },

  // PUT /repos/{owner}/{repo}/contents/{path}
  // Per GitHub docs: body must include `message` and `content` (base64).
  // `sha` required when updating an existing file. Returns 422 when the
  // body is malformed, 409 when the sha doesn't match.
  {
    method: "PUT",
    regex: /^\/repos\/([^/]+)\/([^/]+)\/contents\/(.+)$/,
    handle(req, match, state) {
      const body = req.parsedBody;
      if (!body || typeof body !== "object") {
        return json(400, { message: "Request body is not valid JSON" });
      }
      if (typeof body.message !== "string" || body.message.length === 0) {
        return json(422, {
          message: "Validation Failed",
          errors: [{ resource: "Commit", field: "message", code: "missing" }],
        });
      }
      if (typeof body.content !== "string" || body.content.length === 0) {
        return json(422, {
          message: "Validation Failed",
          errors: [{ resource: "Commit", field: "content", code: "missing" }],
        });
      }
      const key = `${match[1]}/${match[2]}/${decodeURIComponent(match[3])}`;
      const existing = state.githubFiles.get(key);
      if (existing && !body.sha) {
        return json(422, {
          message: 'Invalid request.\n\n"sha" wasn\'t supplied.',
          documentation_url:
            "https://docs.github.com/rest/repos/contents#create-or-update-file-contents",
        });
      }
      if (existing && body.sha !== existing.sha) {
        return json(409, {
          message: `${decodeURIComponent(match[3])} does not match ${existing.sha}`,
          documentation_url:
            "https://docs.github.com/rest/repos/contents#create-or-update-file-contents",
        });
      }
      const newSha = nextSha(state);
      state.githubFiles.set(key, { content: body.content, sha: newSha });
      return json(existing ? 200 : 201, {
        content: {
          name: match[3].split("/").pop(),
          path: decodeURIComponent(match[3]),
          sha: newSha,
          size: body.content.length,
          url: `${req.mockBaseUrl}${req.url}`,
          html_url: `https://github.com/${match[1]}/${match[2]}/blob/${body.branch || "main"}/${match[3]}`,
        },
        commit: {
          sha: `c${newSha.slice(1)}`,
          message: body.message,
          author: body.author || { name: "mock", email: "mock@example.com" },
        },
      });
    },
  },
];

function validateGithubAuth(req) {
  const auth = req.headers.authorization || "";
  // Per GitHub REST docs: "token ghp_..." or "Bearer ghp_..." are both valid.
  if (!/^(token|Bearer)\s+\S+$/i.test(auth)) {
    return json(401, {
      message: "Requires authentication",
      documentation_url: "https://docs.github.com/rest",
    });
  }
  return null;
}

// Etherpad HTTP API handlers — spec: https://etherpad.org/doc/v1.8.18/#index_http_api
//
// Every Etherpad response has the same envelope: { code, message, data }
//   code 0 = ok
//   code 1 = wrong parameters (used for both "pad already exists" and
//            "pad does not exist", differentiated by `message`)
//   code 4 = no or wrong API key
// Auth is via `apikey` query param, not header.
// ---------------------------------------------------------------------------

const ETHERPAD_PATH_PATTERNS = [
  // GET /api/1/createPad?apikey=&padID=&text=
  // Per Etherpad docs: creates a new pad. If padID already exists, returns
  // code 1 with message starting "padID does already exist". The production
  // provider in server/src/providers/etherpad.js treats that case as success.
  {
    method: "GET",
    regex: /^\/api\/1\/createPad$/,
    handle(req, _match, state) {
      const params = new URL(req.url, "http://placeholder").searchParams;
      const padID = params.get("padID");
      if (!padID) {
        return etherpadEnvelope(200, 1, "padID is required", null);
      }
      if (state.etherpadPads.has(padID)) {
        return etherpadEnvelope(200, 1, "padID does already exist", null);
      }
      state.etherpadPads.set(padID, params.get("text") || "");
      return etherpadEnvelope(200, 0, "ok", null);
    },
  },

  // GET /api/1/getText?apikey=&padID=
  // Per Etherpad docs: returns the current pad text in `data.text`.
  // If the pad doesn't exist, returns code 1 with the matching message.
  {
    method: "GET",
    regex: /^\/api\/1\/getText$/,
    handle(req, _match, state) {
      const params = new URL(req.url, "http://placeholder").searchParams;
      const padID = params.get("padID");
      if (!padID) {
        return etherpadEnvelope(200, 1, "padID is required", null);
      }
      if (!state.etherpadPads.has(padID)) {
        return etherpadEnvelope(200, 1, "padID does not exist", null);
      }
      return etherpadEnvelope(200, 0, "ok", {
        text: state.etherpadPads.get(padID),
      });
    },
  },

  // GET /api/1/setText?apikey=&padID=&text=
  // Not currently used by our provider, but included so tests can seed
  // pad content directly without going through createPad.
  {
    method: "GET",
    regex: /^\/api\/1\/setText$/,
    handle(req, _match, state) {
      const params = new URL(req.url, "http://placeholder").searchParams;
      const padID = params.get("padID");
      if (!padID) {
        return etherpadEnvelope(200, 1, "padID is required", null);
      }
      if (!state.etherpadPads.has(padID)) {
        return etherpadEnvelope(200, 1, "padID does not exist", null);
      }
      state.etherpadPads.set(padID, params.get("text") || "");
      return etherpadEnvelope(200, 0, "ok", null);
    },
  },
];

function etherpadEnvelope(httpStatus, code, message, data) {
  return {
    status: httpStatus,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, message, data }),
  };
}

function validateEtherpadAuth(req) {
  // Etherpad's API key arrives as a `?apikey=` query parameter on every
  // request, not as a header. Match the real server: missing/empty key
  // → code 4, HTTP 200 (Etherpad never returns 401 — auth failures are
  // surfaced inside the JSON envelope).
  const url = new URL(req.url, "http://placeholder");
  const apikey = url.searchParams.get("apikey");
  if (!apikey || apikey.length === 0) {
    return etherpadEnvelope(200, 4, "no or wrong API Key", null);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Qualtrics REST v3 handlers — spec:
// https://api.qualtrics.com/1179a68b7183c-retrieve-a-survey-response
//
// Auth: `X-API-TOKEN` header, any non-empty value (we don't validate
// identity, only shape — same convention as the GitHub mock). Missing
// header → 401.
// ---------------------------------------------------------------------------

const QUALTRICS_PATH_PATTERNS = [
  // GET /API/v3/surveys/{surveyId}/responses/{responseId}
  // Per Qualtrics docs: 200 + `{result, meta}` when the response exists,
  // 404 + `{meta: {error}}` if it doesn't. We let tests seed
  // (surveyId, responseId) → result via `mock.seedQualtricsResponse(...)`.
  // Unseeded fetches return 404 — same as a real survey/response that
  // hasn't been recorded yet.
  {
    method: "GET",
    regex: /^\/API\/v3\/surveys\/([^/]+)\/responses\/([^/]+)$/,
    handle(_req, match, state) {
      const [, surveyId, responseId] = match;
      const key = `${surveyId}/${responseId}`;
      const seeded = state.qualtricsResponses.get(key);
      if (!seeded) {
        return json(404, {
          meta: {
            httpStatus: "404 - Not Found",
            error: {
              errorMessage: "Response not found",
              errorCode: "RP_3",
            },
          },
        });
      }
      state.qualtricsRequestCounter += 1;
      return json(200, {
        result: seeded,
        meta: {
          requestId: `mock-${state.qualtricsRequestCounter}`,
          httpStatus: "200 - OK",
        },
      });
    },
  },

  // GET /API/v3/survey-definitions/{surveyId}/metadata
  // Used by the server's batch-init validator (getTreatments.js) to confirm
  // a treatment's qualtrics surveyId is reachable. The validator only reads
  // `result.SurveyName`, so a minimal payload satisfies it. Tests can seed
  // a surveyId via `mock.seedQualtricsSurveyDefinition(...)` to override
  // the canned name; unseeded surveyIds return a default mock survey.
  {
    method: "GET",
    regex: /^\/API\/v3\/survey-definitions\/([^/]+)\/metadata$/,
    handle(_req, match, state) {
      const [, surveyId] = match;
      const seeded = state.qualtricsSurveyDefs.get(surveyId);
      const surveyName = seeded?.SurveyName ?? `Mock Survey ${surveyId}`;
      state.qualtricsRequestCounter += 1;
      return json(200, {
        result: {
          SurveyID: surveyId,
          SurveyName: surveyName,
          ...(seeded ?? {}),
        },
        meta: {
          requestId: `mock-${state.qualtricsRequestCounter}`,
          httpStatus: "200 - OK",
        },
      });
    },
  },
];

function validateQualtricsAuth(req) {
  // Per Qualtrics docs: `X-API-TOKEN` header required, missing/invalid
  // returns 401. We accept any non-empty value (shape-only, like GitHub).
  const token = req.headers["x-api-token"] || "";
  if (!token || token.trim().length === 0) {
    return json(401, {
      meta: {
        httpStatus: "401 - Unauthorized",
        error: {
          errorMessage:
            "Qualtrics API user could not be authenticated. Please check that your token is correct.",
          errorCode: "AUTH_6",
        },
      },
    });
  }
  return null;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const PROVIDERS = {
  github: {
    pathPrefix: "/github",
    auth: validateGithubAuth,
    patterns: GITHUB_PATH_PATTERNS,
  },
  etherpad: {
    pathPrefix: "/etherpad",
    auth: validateEtherpadAuth,
    patterns: ETHERPAD_PATH_PATTERNS,
  },
  qualtrics: {
    pathPrefix: "/qualtrics",
    auth: validateQualtricsAuth,
    patterns: QUALTRICS_PATH_PATTERNS,
  },
};

function json(status, body) {
  return {
    status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function nextSha(state) {
  state.shaCounter += 1;
  return state.shaCounter.toString(16).padStart(40, "0");
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return { raw: "", parsed: undefined };
  const ct = req.headers["content-type"] || "";
  if (ct.includes("application/json")) {
    try {
      return { raw, parsed: JSON.parse(raw) };
    } catch {
      return { raw, parsed: undefined };
    }
  }
  return { raw, parsed: undefined };
}

export async function launchMockExternal({ port } = {}) {
  const state = {
    recorded: [],
    shaCounter: 0,
    githubFiles: new Map(), // key: "owner/repo/path" → { content, sha }
    etherpadPads: new Map(), // key: padID → text
    qualtricsResponses: new Map(), // key: "surveyId/responseId" → result obj
    qualtricsSurveyDefs: new Map(), // key: surveyId → result-shape override
    qualtricsRequestCounter: 0,
  };

  const server = createServer(async (req, res) => {
    // Parse the full URL for pathname + query handling.
    const requestURL = new URL(req.url, `http://127.0.0.1:${port}`);
    const { pathname } = requestURL;

    const { raw, parsed } = await readBody(req);
    req.parsedBody = parsed;
    req.rawBody = raw;
    req.mockBaseUrl = `http://127.0.0.1:${port}`;

    // Figure out which provider the path belongs to.
    let matchedProvider = null;
    let providerPath = null;
    for (const [name, cfg] of Object.entries(PROVIDERS)) {
      if (
        pathname.startsWith(cfg.pathPrefix + "/") ||
        pathname === cfg.pathPrefix
      ) {
        matchedProvider = name;
        providerPath = pathname.slice(cfg.pathPrefix.length) || "/";
        break;
      }
    }

    const record = {
      provider: matchedProvider,
      method: req.method,
      path: providerPath ?? pathname,
      fullPath: pathname,
      query: Object.fromEntries(requestURL.searchParams),
      headers: req.headers,
      body: parsed,
      rawBody: raw,
      timestamp: Date.now(),
    };

    let response;
    if (!matchedProvider) {
      response = json(404, {
        error: "Unhandled mock path",
        path: pathname,
        hint: "No provider registered for this prefix",
      });
    } else {
      const cfg = PROVIDERS[matchedProvider];
      const authFailure = cfg.auth ? cfg.auth(req) : null;
      if (authFailure) {
        response = authFailure;
      } else {
        // Build a request-like object with providerPath for pattern matching.
        const proxyReq = Object.assign(Object.create(req), {
          url: providerPath + requestURL.search,
          mockBaseUrl: req.mockBaseUrl,
          parsedBody: parsed,
          headers: req.headers,
        });
        let handled = false;
        for (const pat of cfg.patterns) {
          if (pat.method !== req.method) continue;
          const match = providerPath.match(pat.regex);
          if (!match) continue;
          try {
            response = pat.handle(proxyReq, match, state);
          } catch (err) {
            response = json(500, {
              error: "mock handler threw",
              message: err.message,
            });
          }
          handled = true;
          break;
        }
        if (!handled) {
          response = json(404, {
            error: "Unhandled mock route",
            provider: matchedProvider,
            method: req.method,
            path: providerPath,
            hint: "Add a handler in mockExternalServer.mjs if needed",
          });
        }
      }
    }

    record.responseStatus = response.status;
    state.recorded.push(record);

    res.writeHead(response.status, response.headers);
    res.end(response.body);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  const reset = () => {
    state.recorded.length = 0;
    state.githubFiles.clear();
    state.etherpadPads.clear();
    state.qualtricsResponses.clear();
    state.qualtricsSurveyDefs.clear();
    state.shaCounter = 0;
    state.qualtricsRequestCounter = 0;
  };

  const stop = () =>
    new Promise((resolve) => {
      server.close(() => resolve());
    });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    githubBaseUrl: `http://127.0.0.1:${port}/github`,
    etherpadBaseUrl: `http://127.0.0.1:${port}/etherpad`,
    qualtricsBaseUrl: `http://127.0.0.1:${port}/qualtrics`,
    get recorded() {
      return state.recorded;
    },
    // Test-side seeding: drop pad content into the mock without going through
    // a request, e.g. to set up a state where `getText` returns a known value.
    seedEtherpadPad(padID, text) {
      state.etherpadPads.set(padID, text);
    },
    // Test-side seeding: register the `result` payload that should come back
    // when the server fetches a given (surveyId, responseId). Tests typically
    // seed before exercising the qualtrics provider so the round-trip lands
    // a known shape in scienceData.
    seedQualtricsResponse(surveyId, responseId, result) {
      state.qualtricsResponses.set(`${surveyId}/${responseId}`, result);
    },
    // Test-side seeding: override the survey-definition metadata returned for
    // a given surveyId (used by the batch-init validator in getTreatments.js).
    // Unseeded surveys still respond 200 with a default `Mock Survey {id}`
    // name, so most tests don't need to seed this — only those that pin
    // batch-init log lines or specific SurveyName values.
    seedQualtricsSurveyDefinition(surveyId, definition) {
      state.qualtricsSurveyDefs.set(surveyId, definition);
    },
    reset,
    stop,
  };
}
