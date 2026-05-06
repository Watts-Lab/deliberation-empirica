export function checkRequiredEnvironmentVariables() {
  // GITHUB_PRIVATE_DATA_* / GITHUB_PUBLIC_DATA_* env vars dropped
  // alongside centralPrereg — the central public archive (and the
  // private archive that mirrored it) were the only consumers; with
  // the central-archive feature gone, per-batch researcher-specified
  // dataRepos / preregRepos are the only data destinations.
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
