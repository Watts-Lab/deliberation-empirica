// Thin wrapper over Tajriba's GraphQL endpoint. Exposes the operations we
// need to drive a deliberation-empirica study programmatically: create
// batches, start / stop, enroll participants, read scope + attribute state.
//
// Why raw fetch + GraphQL strings instead of `@empirica/tajriba`?
// That package ships with a directory import (`cross-fetch/polyfill`) that
// Node's ESM loader rejects. Going direct to GraphQL sidesteps the
// packaging issue, keeps the wire format visible for anyone reading this
// file, and means the helper has no runtime deps beyond Node's builtin
// fetch — useful for the manager repo consuming the same pattern.
//
// Purpose:
//   - API-driven tests that skip the admin-UI clickthrough.
//   - Prototype the control plane for manager#2 (programmatic Empirica
//     control via Tajriba GraphQL). If this wrapper can do everything
//     the admin UI does, manager can build its researcher-facing
//     dashboard on top of it.

import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");

// Read the service-registration token from the repo's empirica.toml.
// Same value our callbacks subprocess uses in empiricaServer.mjs.
export function readSrtoken() {
  const toml = readFileSync(
    resolve(REPO_ROOT, ".empirica/empirica.toml"),
    "utf8",
  );
  const match = toml.match(/srtoken\s*=\s*"([^"]+)"/);
  if (!match) throw new Error("srtoken missing from .empirica/empirica.toml");
  return match[1];
}

// Run a GraphQL op against tajriba. Returns the data payload; throws on
// any graphql or network error so callers don't have to check response
// shape — the `errors` array in a graphql response still comes back with
// HTTP 200.
//
// Guards against non-JSON responses (proxy error pages, truncated bodies)
// so a failure upstream surfaces with the actual status + body snippet
// instead of an opaque JSON-parse error.
async function gql(endpoint, { query, variables, sessionToken }) {
  const headers = { "content-type": "application/json" };
  if (sessionToken) headers.authorization = `Bearer ${sessionToken}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
  const rawText = await res.text();
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `Non-JSON response from ${endpoint} (HTTP ${res.status}, content-type="${contentType}"): ${rawText.slice(0, 500)}`,
    );
  }
  let body;
  try {
    body = JSON.parse(rawText);
  } catch (e) {
    throw new Error(
      `Failed to parse JSON from ${endpoint} (HTTP ${res.status}): ${rawText.slice(0, 500)}`,
    );
  }
  if (body.errors && body.errors.length > 0) {
    throw new Error(
      `GraphQL error: ${body.errors.map((e) => e.message).join("; ")}`,
    );
  }
  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status}: ${JSON.stringify(body).slice(0, 500)}`,
    );
  }
  return body.data;
}

// Authenticate as a service using the srtoken and return a client handle
// with session token + GraphQL endpoint bound. Every admin op below goes
// through this client.
export async function connectAsAdmin({
  tajribaURL,
  srtoken,
  serviceName = "manager-spike",
}) {
  const endpoint = tajribaURL.endsWith("/query")
    ? tajribaURL
    : `${tajribaURL.replace(/\/$/, "")}/query`;

  const data = await gql(endpoint, {
    query: `
      mutation RegisterService($input: RegisterServiceInput!) {
        registerService(input: $input) { sessionToken }
      }
    `,
    variables: { input: { name: serviceName, token: srtoken } },
  });
  const sessionToken = data.registerService.sessionToken;
  return {
    endpoint,
    sessionToken,
    _gql: (query, variables) =>
      gql(endpoint, { query, variables, sessionToken }),
  };
}

// ---------------------------------------------------------------------------
// Batch lifecycle
// ---------------------------------------------------------------------------

// Matches what the admin UI POSTs. Tajriba stores attribute values as JSON
// strings, so we stringify the config *inside* a wrapper `{ kind, config }`.
// Server/src/callbacks.js reads this via `batch.get("config")` to extract
// `unvalidatedConfig`.
export async function createBatch(client, config, { kind = "custom" } = {}) {
  const data = await client._gql(
    `mutation AddScopes($input: [AddScopeInput!]!) {
       addScopes(input: $input) { scope { id kind name } }
     }`,
    {
      input: [
        {
          kind: "batch",
          attributes: [
            {
              key: "config",
              val: JSON.stringify({ kind, config }),
              immutable: true,
            },
            {
              key: "status",
              val: JSON.stringify("created"),
              protected: true,
            },
          ],
        },
      ],
    },
  );
  const batchId = data?.addScopes?.[0]?.scope?.id;
  if (!batchId) {
    throw new Error(
      `addScopes did not return a scope id; got: ${JSON.stringify(data)}`,
    );
  }
  return batchId;
}

async function setBatchStatus(client, batchId, status) {
  await client._gql(
    `mutation SetAttributes($input: [SetAttributeInput!]!) {
       setAttributes(input: $input) { attribute { id key val } }
     }`,
    {
      input: [
        {
          nodeID: batchId,
          key: "status",
          val: JSON.stringify(status),
          protected: true,
        },
      ],
    },
  );
}

// "running" starts dispatch + opens recruitment; "terminated" triggers
// closeBatch → exportScienceData for all players.
export const startBatch = (client, batchId) =>
  setBatchStatus(client, batchId, "running");
export const stopBatch = (client, batchId) =>
  setBatchStatus(client, batchId, "terminated");

// ---------------------------------------------------------------------------
// Scope + attribute reads
// ---------------------------------------------------------------------------

// Snapshot the whole tajriba state. Returns a Map of scopeId → {scope, attrs, meta}.
//
// Tajriba 1.7 doesn't implement `attributes(scopeID:)` (panics "not
// implemented") and `scopes()` only filters by attribute, not ID. So the
// read pattern that actually works is: fetch all scopes + their attributes
// in one nested query, index client-side. This mirrors how the real
// subscription-based clients build their internal state — they just pay
// for it up front and keep it live via `changes` subscription.
//
// For test-sized batches (tens of scopes, hundreds of attributes) this is
// plenty fast. Production control planes would want a subscription.
export async function snapshot(client, { limit = 500 } = {}) {
  const data = await client._gql(
    `query Snapshot($first: Int, $attrFirst: Int) {
       scopes(first: $first) {
         edges {
           node {
             id kind name
             attributes(first: $attrFirst) {
               edges {
                 node {
                   id key val current version
                   private protected immutable ephemeral
                 }
               }
             }
           }
         }
       }
     }`,
    { first: limit, attrFirst: limit },
  );
  const byId = new Map();
  for (const edge of data?.scopes?.edges ?? []) {
    const s = edge.node;
    const attrs = {};
    const meta = {};
    for (const ae of s.attributes?.edges ?? []) {
      const a = ae.node;
      if (!a?.current) continue;
      try {
        attrs[a.key] = a.val != null ? JSON.parse(a.val) : null;
      } catch {
        attrs[a.key] = a.val;
      }
      meta[a.key] = {
        private: a.private,
        protected: a.protected,
        immutable: a.immutable,
        ephemeral: a.ephemeral,
        version: a.version,
      };
    }
    byId.set(s.id, { scope: s, attrs, meta });
  }
  return byId;
}

// List scopes of a given kind. Lightweight by default (no attributes) so
// polling loops don't re-fetch the full attribute set every tick. Pass
// `snap` to pull from an already-fetched snapshot instead.
export async function listScopes(client, { kind, snap } = {}) {
  if (snap) {
    const all = Array.from(snap.values()).map((e) => e.scope);
    return kind ? all.filter((s) => s.kind === kind) : all;
  }
  const data = await client._gql(
    `query ListScopes($first: Int) {
       scopes(first: $first) {
         edges { node { id kind name } }
       }
     }`,
    { first: 500 },
  );
  const all = data?.scopes?.edges?.map((e) => e.node) ?? [];
  return kind ? all.filter((s) => s.kind === kind) : all;
}

// Read attributes for a specific scope. Takes an optional pre-fetched
// snapshot to avoid round-tripping when the caller already has one.
export async function getAttributes(client, scopeId, { snap } = {}) {
  const s = snap || (await snapshot(client));
  const entry = s.get(scopeId);
  if (!entry) {
    throw new Error(`Scope ${scopeId} not found in snapshot`);
  }
  return { attrs: entry.attrs, meta: entry.meta };
}

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

// Creates a *tajriba* participant record (not an empirica "player" scope).
// The player scope is a classic-runtime concept created when a browser
// connects and runs the @empirica/core client, which links the
// participant to a batch/game and creates the scope.
//
// For API-only use: this gets you a participant ID and session token the
// participant would use for subsequent ops, but the empirica server
// callbacks that respond to "new player" won't fire. If you want those
// callbacks, drive a real browser for the participant side.
// List all tajriba participants. Unlike scopes, this one IS implemented
// at the top-level query.
export async function listParticipants(client, { limit = 200 } = {}) {
  const data = await client._gql(
    `query Participants($first: Int) {
       participants(first: $first) {
         edges { node { id identifier createdAt } }
       }
     }`,
    { first: limit },
  );
  return data?.participants?.edges?.map((e) => e.node) ?? [];
}

export async function addParticipant(client, identifier) {
  const data = await client._gql(
    `mutation AddParticipant($input: AddParticipantInput!) {
       addParticipant(input: $input) {
         participant { id identifier }
         sessionToken
       }
     }`,
    { input: { identifier } },
  );
  return {
    participant: data.addParticipant.participant,
    sessionToken: data.addParticipant.sessionToken,
  };
}

// Count players by progression bucket, mirroring
// server/src/utils/logging.js `logPlayerCounts`. Source of truth for
// "where are my participants right now."
export async function summarizePlayerProgression(client, { snap } = {}) {
  const s = snap || (await snapshot(client));
  const buckets = {
    completed: 0,
    inExitSequence: 0,
    inGame: 0,
    inLobby: 0,
    inCountdown: 0,
    inIntro: 0,
    disconnected: 0,
    unknown: 0,
  };
  const details = [];
  for (const entry of s.values()) {
    if (entry.scope.kind !== "player") continue;
    const bucket = classifyPlayer(entry.attrs);
    buckets[bucket] += 1;
    details.push({ id: entry.scope.id, bucket, attrs: entry.attrs });
  }
  return { buckets, details };
}

// Pure classification from attribute map → bucket name. Matches
// logPlayerCounts() so test and server stay in sync on the definition
// of "in lobby" / "in game" / etc.
export function classifyPlayer(attrs) {
  if (attrs.exitStatus === "complete") return "completed";
  if (attrs.gameFinished && attrs.connected) return "inExitSequence";
  if ((attrs.gameId || attrs.assigned) && attrs.connected) return "inGame";
  if (attrs.introDone && attrs.connected) return "inLobby";
  if (attrs.inCountdown && attrs.connected) return "inCountdown";
  if (attrs.connected) return "inIntro";
  if (attrs.connected === false) return "disconnected";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Wait helpers
// ---------------------------------------------------------------------------

// Poll until `predicate(attrs)` returns truthy on the given scope. Server
// reacts to mutations asynchronously; this is how we wait for e.g.
// `initialized: true` after creating a batch.
export async function waitForAttribute(
  client,
  scopeId,
  predicate,
  { timeoutMs = 30_000, intervalMs = 500 } = {},
) {
  const deadline = Date.now() + timeoutMs;
  let lastAttrs;
  while (Date.now() < deadline) {
    let attrs;
    try {
      // eslint-disable-next-line no-await-in-loop
      ({ attrs } = await getAttributes(client, scopeId));
    } catch (err) {
      // The only expected transient error here is the scope not existing
      // yet — the server creates scopes async after some mutations. Any
      // other error (auth, GraphQL, network) indicates a real problem and
      // we should surface it rather than poll through it.
      if (err.message.includes("not found in snapshot")) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => {
          setTimeout(r, intervalMs);
        });
        continue;
      }
      throw err;
    }
    lastAttrs = attrs;
    if (predicate(attrs)) return attrs;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => {
      setTimeout(r, intervalMs);
    });
  }
  throw new Error(
    `waitForAttribute timed out after ${timeoutMs}ms on scope ${scopeId}. Last attrs: ${JSON.stringify(
      lastAttrs,
    ).slice(0, 500)}`,
  );
}
