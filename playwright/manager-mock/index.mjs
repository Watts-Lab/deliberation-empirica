// Convenience wrapper for tests that want one-call manager-mock setup.
// Returns a handle with `start`/`stop`/`url` plus passthroughs to the
// state object so test code can script responses + inspect captures
// without holding a separate state reference.
//
// Symmetric to the standalone runner pattern in
// manager/tools/mock-runtime/src/index.ts — though the runner there is
// a CLI and this is library-only (we don't have a compelling
// standalone-curl use case yet).

import { ManagerMockState } from "./state.mjs";
import { buildServer } from "./server.mjs";

export { ManagerMockState, buildServer };

export function buildManagerMock({
  port = 0, // 0 → assign ephemeral port; read via `mock.url` after start
  host = "127.0.0.1",
  jwtVerify,
  secret,
  expectedInstanceId,
  logger,
} = {}) {
  const state = new ManagerMockState();
  const server = buildServer({
    state,
    jwtVerify,
    secret,
    expectedInstanceId,
    logger,
  });

  let assignedUrl = null;
  return {
    state,
    server,
    get url() {
      return assignedUrl;
    },
    async start() {
      await new Promise((resolve, reject) => {
        const onError = (err) => reject(err);
        server.once("error", onError);
        server.listen(port, host, () => {
          server.off("error", onError);
          const addr = server.address();
          assignedUrl = `http://${host}:${addr.port}`;
          resolve();
        });
      });
      return assignedUrl;
    },
    async stop() {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
    // Sugar passthroughs so tests don't have to reach into `state`.
    received: () => state.received(),
    enqueueAck: (...args) => state.enqueueAck(...args),
    enqueueRetry: (...args) => state.enqueueRetry(...args),
    enqueueDiscard: (...args) => state.enqueueDiscard(...args),
    reset: () => state.reset(),
  };
}
