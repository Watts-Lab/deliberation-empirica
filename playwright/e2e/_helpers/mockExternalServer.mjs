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
          message:
            'Invalid request.\n\n"sha" wasn\'t supplied.',
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

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const PROVIDERS = {
  github: {
    pathPrefix: "/github",
    auth: validateGithubAuth,
    patterns: GITHUB_PATH_PATTERNS,
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
      if (pathname.startsWith(cfg.pathPrefix + "/") || pathname === cfg.pathPrefix) {
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
    state.shaCounter = 0;
  };

  const stop = () =>
    new Promise((resolve) => {
      server.close(() => resolve());
    });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    githubBaseUrl: `http://127.0.0.1:${port}/github`,
    get recorded() {
      return state.recorded;
    },
    reset,
    stop,
  };
}
