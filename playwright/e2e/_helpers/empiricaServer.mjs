import { spawn } from "child_process";
import { mkdtempSync, rmSync, mkdirSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

import { portsForWorker } from "./ports.mjs";
import { launchMockExternal } from "./mockExternalServer.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");

// Pull the srtoken (service-registration token) from the repo's empirica.toml.
// Empirica normally reads this itself and threads it through to the callbacks
// process as `--token`, but when we override `--callbacks.devcmd` it doesn't,
// so we read it and pass it explicitly. AdminContext.init in
// server/src/index.js needs this to register.
function readSrtoken() {
  const toml = readFileSync(
    resolve(REPO_ROOT, ".empirica/empirica.toml"),
    "utf8",
  );
  const match = toml.match(/srtoken\s*=\s*"([^"]+)"/);
  if (!match) {
    throw new Error("Could not find srtoken in .empirica/empirica.toml");
  }
  return match[1];
}

async function waitForHTTP(
  url,
  { timeoutMs = 120_000, intervalMs = 500 } = {},
) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404 || res.status === 401) return;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `timed out waiting for ${url} after ${timeoutMs}ms: ${lastErr?.message ?? "unknown"}`,
  );
}

// Spawn a mock CDN by serving a fixtures directory over HTTP.
// `detached: true` puts the child in its own process group so we can kill
// the whole tree (npx -> node -> serve) on shutdown.
function startCDN({ fixtureDir, port, logPrefix }) {
  const proc = spawn(
    "npx",
    // Pin the `serve` major version. `npx --yes serve` resolves at
    // runtime, so a future release that renames `--cors` (or any other
    // flag we depend on) would break CI nondeterministically without
    // any code change here. Bump the pin deliberately, not implicitly.
    //
    // `--cors` sets `Access-Control-Allow-Origin: *` so participant
    // browsers (running on the empirica port) can fetch prompt content
    // from the fixture CDN (different port). Without it, axios/XHR
    // requests fail with `net::ERR_FAILED` and stagebook renders an
    // "Error loading prompt" placeholder. Smoke's runParticipant
    // silently fell through (`if (await promptBox.count()) ...`), so
    // this gap went unnoticed until the multi/ test actually needed
    // to interact with prompt content.
    [
      "--yes",
      "serve@14.2.6",
      fixtureDir,
      "-l",
      String(port),
      "--no-clipboard",
      "--cors",
    ],
    {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
      detached: true,
    },
  );
  proc.stdout.on("data", (d) => {
    process.stdout.write(`[${logPrefix} cdn] ${d}`);
  });
  proc.stderr.on("data", (d) => {
    process.stderr.write(`[${logPrefix} cdn] ${d}`);
  });
  return proc;
}

function startEmpirica({ ports, sessionTokenPath, dataDir, logPrefix, env }) {
  // `empirica` with no subcommand runs dev mode (server + client vite, no auth).
  // `empirica serve` is for production bundles and takes a different flag set.
  //
  // The callbacks process reads its tajriba URL + auth from its own argv
  // (see server/src/index.js:30-37). In stock dev mode empirica doesn't
  // reliably forward those, so we pass them explicitly on the devcmd:
  //   --url=http://localhost:<empiricaPort>/query
  //   --sessionTokenPath=<worker's token path>
  // The devcmd skips the server rebuild step (globalSetup handled that once).
  const srtoken = readSrtoken();
  const callbacksDevcmd = [
    "node",
    "--enable-source-maps",
    "dist/index.js",
    `--url=http://localhost:${ports.empirica}/query`,
    `--sessionTokenPath=${sessionTokenPath}`,
    `--token=${srtoken}`,
  ].join(" ");

  // Each worker gets its own tajriba.json file inside its scratch dir.
  // `--tajriba.store.mem` looked attractive for isolation but it doesn't
  // let empirica bootstrap the service-account auth that the callbacks
  // process needs (the session token never gets written).
  const tajribaFile = `${dataDir}/tajriba.json`;

  const args = [
    `--tajriba.store.file=${tajribaFile}`,
    `--server.addr=:${ports.empirica}`,
    `--server.proxyaddr=http://127.0.0.1:${ports.vite}`,
    `--tajriba.server.addr=:${ports.tajriba}`,
    `--callbacks.sessionTokenPath=${sessionTokenPath}`,
    `--callbacks.devcmd=${callbacksDevcmd}`,
  ];

  // `detached: true` puts empirica in its own process group so we can kill
  // the whole subtree (empirica -> vite, empirica -> callbacks node process)
  // in one shot. Empirica doesn't propagate SIGTERM to its children.
  const proc = spawn("empirica", args, {
    cwd: REPO_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ...env,
      VITE_PORT: String(ports.vite),
      BUNDLE_DATE: "e2e",
      TEST_CONTROLS: "enabled",
      DATA_DIR: dataDir,
      // Batch configs must use `cdn: "test"` (server's zod schema restricts
      // the cdn field to "test"/"prod"/"local"). This env var routes that
      // key to the worker-specific mock CDN port.
      CDN_TEST_URL: `http://127.0.0.1:${ports.cdn}`,
      // Route external-provider calls to the in-process mock server so
      // tests can assert on outbound calls without hitting real services.
      // See _helpers/mockExternalServer.mjs.
      GITHUB_API_BASE_URL: `http://127.0.0.1:${ports.mockExternal}/github`,
      DAILY_API_BASE_URL: `http://127.0.0.1:${ports.mockExternal}/daily`,
      // Daily mock validates `Authorization: Bearer <key>` is non-empty.
      // In dailyco.js, the hard "missing key" guard is a falsy check
      // (createRoom throws when DAILY_APIKEY is unset/empty); the literal
      // "none" is *not* treated as missing there — it's a sentinel used
      // only inside catch blocks to suppress errors. Default to a
      // non-empty dummy so the mock auth check passes; nullish coalescing
      // means only an unset value falls back, while an explicitly empty
      // value or "none" passes through unchanged so tests can exercise
      // the production guard / suppression paths.
      DAILY_APIKEY: process.env.DAILY_APIKEY ?? "e2e-dummy-daily-key",
      ETHERPAD_BASE_URL: `http://127.0.0.1:${ports.mockExternal}/etherpad`,
      // Etherpad mock requires apikey query param to be non-empty (matches
      // real Etherpad: missing key → code 4). Provide a stable dummy so
      // CI / contributors without a real key still hit the successful auth
      // path — same rationale as DELIBERATION_MACHINE_USER_TOKEN below.
      ETHERPAD_API_KEY:
        process.env.ETHERPAD_API_KEY || "e2e-dummy-etherpad-key",
      QUALTRICS_API_BASE_URL: `http://127.0.0.1:${ports.mockExternal}/qualtrics`,
      // Qualtrics provider reads X-API-TOKEN from QUALTRICS_API_TOKEN; the
      // mock validates the header is non-empty (matches Qualtrics: missing
      // → 401). Provide a stable dummy so contributors without a real
      // token still hit the success path. Same rationale as
      // DELIBERATION_MACHINE_USER_TOKEN.
      //
      // Nullish coalescing (??) so a deliberately empty string passes
      // through verbatim — that lets a future test exercise the 401 path
      // by setting QUALTRICS_API_TOKEN="" instead of having to bypass
      // the harness. Only an *unset* env falls back to the dummy.
      QUALTRICS_API_TOKEN:
        process.env.QUALTRICS_API_TOKEN ?? "e2e-dummy-qualtrics-token",
      // QUALTRICS_DATACENTER is only used to build the default URL when
      // QUALTRICS_API_BASE_URL is unset; we override the base URL above so
      // this is purely a placeholder. Provide a value so the provider
      // doesn't trip on undefined when constructing log strings.
      QUALTRICS_DATACENTER: process.env.QUALTRICS_DATACENTER || "iad1",
      // Force a token so Octokit always sends an Authorization header.
      // Without this, a machine without a real token in `.env` (CI, or any
      // contributor who hasn't set one up) gets 401'd by the mock's
      // spec-driven auth gate, and `getAssetsRepoSha` returns undefined.
      // The value is arbitrary — the mock validates shape, not identity.
      DELIBERATION_MACHINE_USER_TOKEN:
        process.env.DELIBERATION_MACHINE_USER_TOKEN ||
        "e2e-dummy-token-not-a-real-credential",
    },
    detached: true,
  });
  proc.stdout.on("data", (d) => {
    process.stdout.write(`[${logPrefix} empirica] ${d}`);
  });
  proc.stderr.on("data", (d) => {
    process.stderr.write(`[${logPrefix} empirica] ${d}`);
  });
  return proc;
}

// Spawn a fully isolated Empirica stack for a single test file.
//
// Returns { urls, ports, stop() } where urls = { admin, player, cdn }.
// Call stop() in afterAll. Idempotent.
export async function launchStack({ workerIndex, fixtureDir, logPrefix }) {
  const ports = portsForWorker(workerIndex);
  const label = logPrefix ?? `worker-${workerIndex}`;

  const scratchDir = mkdtempSync(join(tmpdir(), `e2e-${label}-`));
  const sessionTokenPath = join(scratchDir, "sessionToken");
  const dataDir = join(scratchDir, "data");
  mkdirSync(dataDir, { recursive: true });

  const cdnProc = startCDN({ fixtureDir, port: ports.cdn, logPrefix: label });
  // In-process mock for external providers (GitHub, Daily, ...). Must be
  // up before empirica starts so the first callbacks-side call lands.
  const mockExternal = await launchMockExternal({ port: ports.mockExternal });
  const empiricaProc = startEmpirica({
    ports,
    sessionTokenPath,
    dataDir,
    logPrefix: label,
    env: {},
  });

  // Kill the whole process group (signed negative pid). Empirica and the
  // CDN `npx` wrapper both spawn their own children (vite, callbacks node,
  // serve) that don't forward signals sent just to the parent.
  const killGroup = (proc, signal) => {
    if (!proc || proc.exitCode !== null) return;
    try {
      process.kill(-proc.pid, signal);
    } catch {
      try {
        proc.kill(signal);
      } catch {}
    }
  };

  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    killGroup(empiricaProc, "SIGTERM");
    killGroup(cdnProc, "SIGTERM");
    await new Promise((r) => setTimeout(r, 1500));
    killGroup(empiricaProc, "SIGKILL");
    killGroup(cdnProc, "SIGKILL");
    try {
      await mockExternal.stop();
    } catch {}
    if (!process.env.E2E_KEEP_SCRATCH) {
      try {
        rmSync(scratchDir, { recursive: true, force: true });
      } catch {}
    } else {
      // eslint-disable-next-line no-console
      console.log(`[${label}] kept scratch dir: ${scratchDir}`);
    }
  };

  const onExit = () => stop().catch(() => {});
  process.once("exit", onExit);

  try {
    await Promise.all([
      waitForHTTP(`http://127.0.0.1:${ports.cdn}/`, { timeoutMs: 30_000 }),
      waitForHTTP(`http://127.0.0.1:${ports.empirica}/admin/`, {
        timeoutMs: 180_000,
      }),
    ]);
  } catch (err) {
    await stop();
    throw err;
  }

  return {
    ports,
    urls: {
      admin: `http://127.0.0.1:${ports.empirica}/admin/`,
      player: `http://127.0.0.1:${ports.empirica}/`,
      cdn: `http://127.0.0.1:${ports.cdn}/`,
    },
    // Where the server writes participant/batch JSONL files (scienceData,
    // preregistration, postFlightReport, participantData/). Tests read
    // from here to verify data-export shape.
    dataDir,
    // In-process mock for external-provider APIs. Use `mock.recorded` to
    // assert on outbound calls the server made. See mockExternalServer.mjs.
    mock: mockExternal,
    stop,
  };
}
