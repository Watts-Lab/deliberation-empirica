import { execSync } from "child_process";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");

// Build the server bundle once before workers start. Each worker then
// launches empirica with --callbacks.devcmd="node dist/index.js" so we
// avoid concurrent rebuilds of server/dist/.
export default async function globalSetup() {
  // eslint-disable-next-line no-console
  console.log("[e2e globalSetup] building server bundle...");
  execSync("npm run --silent build", {
    cwd: resolve(REPO_ROOT, "server"),
    stdio: "inherit",
  });
  // eslint-disable-next-line no-console
  console.log("[e2e globalSetup] server bundle ready.");
}
