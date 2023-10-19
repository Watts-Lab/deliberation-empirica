import { AdminContext } from "@empirica/core/admin";
import { info, setLogLevel } from "@empirica/core/console";
import {
  Classic,
  classicKinds,
  ClassicLoader,
} from "@empirica/core/admin/classic";
import minimist from "minimist";
import process from "process";
import { Empirica } from "./callbacks";

const argv = minimist(process.argv.slice(2), { string: ["token"] });

setLogLevel(argv.loglevel || "info");

(async () => {
  const ctx = await AdminContext.init(
    argv.url || "http://localhost:3000/query",
    argv.sessionTokenPath,
    "callbacks",
    argv.token,
    {},
    classicKinds
  );

  ctx.register(ClassicLoader); // subscribes to players and batches
  ctx.register(
    Classic({
      disableAssignment: true,
      disableGameCreation: true,
      disableBatchAutoend: true,
    })
  );
  ctx.register(Empirica);
  ctx.register((_) => {
    _.on("ready", () => {
      info("callbacks: started");
    });
  });
})();

process.on("unhandledRejection", (reason, p) => {
  process.exitCode = 1;
  console.error("Unhandled Promise Rejection. Reason: ", reason);
});
