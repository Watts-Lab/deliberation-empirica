export function checkRequiredEnvironmentVariables() {

  const requiredInProd = [
    "DAILY_APIKEY",
    "QUALTRICS_API_TOKEN",
    "QUALTRICS_DATACENTER",
    "DELIBERATION_MACHINE_USER_TOKEN",
    "GITHUB_PRIVATE_DATA_OWNER",
    "GITHUB_PRIVATE_DATA_REPO",
    "GITHUB_PRIVATE_DATA_BRANCH",
    "GITHUB_PUBLIC_DATA_OWNER",
    "GITHUB_PUBLIC_DATA_REPO",
    "GITHUB_PUBLIC_DATA_BRANCH",
    "ETHERPAD_API_KEY",
    "ETHERPAD_BASE_URL",
  ]

  // TEST_CONTROLS === "enabled" allows for dev
  if (process.env.TEST_CONTROLS !== "enabled") {
    for (const envVar of requiredInProd) {
      if (!process.env[envVar] || process.env[envVar] === "none") {
        throw new Error(`Missing required environment variable ${envVar}`);
      }
    }
  }

  const requiredInDevAndProd = [
    "DATA_DIR",
  ]

  // eslint-disable-next-line no-restricted-syntax
  for (const envVar of requiredInDevAndProd) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable ${envVar}`);
    }
  }
}
