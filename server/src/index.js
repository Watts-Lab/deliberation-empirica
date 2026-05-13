import { AdminContext } from "@empirica/core/admin";
import { info, setLogLevel } from "@empirica/core/console";
import {
  Classic,
  classicKinds,
  ClassicLoader,
} from "@empirica/core/admin/classic";
import minimist from "minimist";
import process from "process";
import * as Sentry from "@sentry/node";
import { Empirica } from "./callbacks";

// DSN baked into source. Sentry's `runner-backend` project; separate
// from the browser-side `runner-frontend` project so server alerts +
// quotas are isolated from the noisier client surface. The
// `NODE_ENV === "production"` gate means solo-dev runs don't ship
// events — only the runtime image (Dockerfile sets `NODE_ENV`)
// reports. To rotate, change this literal and cut a new runtime
// release.
if (process.env.NODE_ENV === "production") {
  Sentry.init({
    dsn: "https://10ad96e22825c84a32e00ba62a8fc64c@o4510466125135872.ingest.us.sentry.io/4511382811639808",
    tracesSampleRate: 0.1,
    attachStacktrace: true,
    environment: process.env.NODE_ENV,
    // Disable default PII collection (user IPs, headers, cookies).
    // Mirrors the client's posture; required for participant-facing
    // software. The runtime sees participant traffic via the Empirica
    // websocket layer, not direct HTTP requests, so the practical
    // impact is small — but the flag makes the intent explicit + is
    // a backstop if upstream ever attaches default request headers.
    sendDefaultPii: false,
  });
}

const argv = minimist(process.argv.slice(2), { string: ["token"] });

setLogLevel(argv.loglevel || "info");

(async () => {
  const ctx = await AdminContext.init(
    argv.url || "http://localhost:3000/query",
    argv.sessionTokenPath,
    "callbacks",
    argv.token,
    {},
    classicKinds,
  );

  ctx.register(ClassicLoader); // subscribes to players and batches
  ctx.register(
    Classic({
      disableAssignment: true,
      disableGameCreation: true,
      disableBatchAutoend: true,
    }),
  );
  ctx.register(Empirica);
  ctx.register((_) => {
    _.on("ready", () => {
      info("callbacks: started");
    });
  });
})();

process.on("unhandledRejection", (reason) => {
  process.exitCode = 1;
  console.error("Unhandled Promise Rejection. Reason: ", reason);
  Sentry.captureException(reason, { extra: { source: "unhandledRejection" } });
});
