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

// Sentry initializes only when SENTRY_DSN is explicitly provided via env.
// Same project as the client; filter by `sdk.name` (`sentry.javascript.node`
// vs `sentry.javascript.react`) in the Sentry UI to separate.
if (process.env.SENTRY_DSN && process.env.SENTRY_DSN !== "none") {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    attachStacktrace: true,
    environment: process.env.NODE_ENV || "development",
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
