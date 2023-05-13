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

import * as path from "path";
import * as dotenv from "dotenv";

const argv = minimist(process.argv.slice(2), { string: ["token"] });

// find the path to the .empirica folder
process.env.dotEmpiricaPath = path.normalize(
  path.join(argv["sessionTokenPath"], "../..") // hacky
);
console.log(".empirica path", process.env.dotEmpiricaPath);

// load environment variables from the .env file in the .empirica folder
dotenv.config({ path: `${process.env.dotEmpiricaPath}/.env` });

setLogLevel(argv["loglevel"] || "info");

(async () => {
  const ctx = await AdminContext.init(
    argv["url"] || "http://localhost:3000/query",
    argv["sessionTokenPath"],
    "callbacks",
    argv["token"],
    {},
    classicKinds
  );

  ctx.register(ClassicLoader); // subscribes to players and batches
  ctx.register(Classic({ disableAssignment: true, disableGameCreation: true }));
  ctx.register(Empirica);
  ctx.register(function (_) {
    _.on("ready", function () {
      info("callbacks: started");
    });
  });
})();
