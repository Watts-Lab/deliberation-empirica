import { managerLaunchedEnv } from "@deliberation-lab/contracts/env";

/**
 * Validate the runtime's environment at boot.
 *
 * Two modes — discriminated by `USE_MANAGER_SAVE`:
 *
 * - **Manager-launched** (`USE_MANAGER_SAVE === "true"`). Validate the
 *   full env shape against the `managerLaunchedEnv` schema. The schema
 *   both *requires* the manager-injected fields (MANAGER_URL, JWT
 *   verify secret, instance/batch/study/workspace IDs, resource limits,
 *   etc.) AND *forbids* `DELIBERATION_MACHINE_USER_TOKEN` (its presence
 *   indicates configuration drift — the manager save path replaces
 *   the direct-Octokit token). No TEST_CONTROLS bypass: the manager
 *   always injects the right shape, so any missing field is a real
 *   misconfiguration worth refusing to boot on.
 *
 * - **Solo-dev** (everything else). Keep the long-standing bespoke
 *   prod-required list (provider creds + legacy GitHub token + DATA_DIR).
 *   The schema's `soloDevEnv` is intentionally looser on provider creds
 *   (the runtime falls back gracefully when a treatment doesn't
 *   reference a provider), but tightening that is out of scope here —
 *   we'd be loosening prod's precondition, not strengthening it.
 *   `TEST_CONTROLS === "enabled"` skips the prod-required gate so
 *   local dev / e2e runners don't need real provider keys.
 */
export function checkRequiredEnvironmentVariables() {
  if (process.env.USE_MANAGER_SAVE === "true") {
    const result = managerLaunchedEnv.safeParse(process.env);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
      throw new Error(`Manager-launched env validation failed: ${issues}`);
    }
    return;
  }

  const requiredInProd = [
    "DAILY_APIKEY",
    "QUALTRICS_API_TOKEN",
    "QUALTRICS_DATACENTER",
    "DELIBERATION_MACHINE_USER_TOKEN",
    "ETHERPAD_API_KEY",
    "ETHERPAD_BASE_URL",
  ];

  // TEST_CONTROLS === "enabled" allows for dev
  if (process.env.TEST_CONTROLS !== "enabled") {
    requiredInProd.forEach((envVar) => {
      if (!process.env[envVar] || process.env[envVar] === "none") {
        throw new Error(`Missing required environment variable ${envVar}`);
      }
    });
  }

  const requiredInDevAndProd = ["DATA_DIR"];

  requiredInDevAndProd.forEach((envVar) => {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable ${envVar}`);
    }
  });
}
