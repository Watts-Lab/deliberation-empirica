export function checkRequiredEnvironmentVariables() {
  const requiredEnvVars = [
    "DAILY_APIKEY",
    "QUALTRICS_API_TOKEN",
    "QUALTRICS_DATACENTER",
    "DELIBERATION_MACHINE_USER_TOKEN",
    "DATA_DIR",
    "GITHUB_PRIVATE_DATA_OWNER",
    "GITHUB_PRIVATE_DATA_REPO",
    "GITHUB_PRIVATE_DATA_BRANCH",
    "GITHUB_PUBLIC_DATA_OWNER",
    "GITHUB_PUBLIC_DATA_REPO",
    "GITHUB_PUBLIC_DATA_BRANCH",
    "ETHERPAD_API_KEY",
    "ETHERPAD_BASE_URL",
  ];

  // eslint-disable-next-line no-restricted-syntax
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable ${envVar}`);
    }
  }
}
