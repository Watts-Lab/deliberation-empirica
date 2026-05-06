import { Octokit } from "octokit";
import * as path from "path";
import * as fs from "fs";
import { error, warn, info } from "@empirica/core/console";

const pushTimers = new Map();

const rawGithubToken = process.env.DELIBERATION_MACHINE_USER_TOKEN;
const githubToken =
  rawGithubToken && rawGithubToken !== "none" ? rawGithubToken : undefined;

const octokitOptions = {};
if (githubToken) octokitOptions.auth = githubToken;
// Override the API host for e2e tests that route GitHub calls to a mock
// server. Defaults to Octokit's built-in https://api.github.com.
if (process.env.GITHUB_API_BASE_URL) {
  octokitOptions.baseUrl = process.env.GITHUB_API_BASE_URL;
}
const octokit = new Octokit(octokitOptions);

export async function checkGithubAuth() {
  if (!githubToken) {
    warn(
      "DELIBERATION_MACHINE_USER_TOKEN is not set; skipping GitHub auth check (GitHub features that require auth may be unavailable).",
    );
    return false;
  }

  const result = await octokit.rest.rateLimit.get();
  const tokenTail = githubToken.slice(-4);

  if (result?.data?.rate?.limit < 5000) {
    throw new Error(`Github authentication failed with token ****${tokenTail}`);
  }

  info(`Github authentication succeeded with token ****${tokenTail}`);

  return true;
}

// Resolve the head commit sha of {owner}/{repo}/{branch}. We stamp this
// into the data export so analysts can recover the exact state of the
// assets repo a participant saw by running `git show <sha>:<path>` — no
// server-side tree cache required (see issue #10).
export async function getRepoHeadSha({ owner, repo, branch }) {
  info("Getting repo head sha ", owner, repo, branch);
  try {
    const result = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    return result.data.object.sha;
  } catch (e) {
    error("Error getting repo head sha ", e);
    return undefined;
  }
}

/**
 * Validates read access to a GitHub repository and branch.
 *
 * This function only checks read access (repository/branch existence) using
 * octokit.rest.git.getRef(). It does NOT validate write permissions - those
 * are checked later during actual file commit operations for better performance.
 *
 * @param {Object} params - Repository parameters
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {string} params.branch - Branch name
 * @returns {Promise<boolean>} - Returns true if repository/branch is accessible
 * @throws {Error} - Throws error if repository/branch is not accessible
 */
export async function validateRepoAccess({ owner, repo, branch }) {
  try {
    await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    info(`Successfully validated read access to ${owner}/${repo}/${branch}`);
    return true;
  } catch (e) {
    if (e.status === 404) {
      error(`Repository or branch not found: ${owner}/${repo}/${branch}`);
    } else if (e.status === 403) {
      error(`Access denied to repository: ${owner}/${repo}/${branch}`);
    } else {
      error(`Error accessing repository ${owner}/${repo}/${branch}:`, e);
    }
    throw new Error(
      `Cannot access repository ${owner}/${repo}/${branch}: ${e.message}`,
    );
  }
}

async function getFileSha({ owner, repo, branch, directory, filename }) {
  try {
    const result = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: path.join(directory, filename),
      ref: branch,
    });
    if (result.status === 200) {
      return result.data.sha;
    }
    return undefined;
  } catch (e) {
    if (e.status === 404) return undefined;
    error("Error checking if file exists ", e);
    return undefined;
  }
}

function loadFileToBase64(filepath) {
  const file = fs.readFileSync(filepath);
  const base64 = file.toString("base64");
  return base64;
}

export async function commitFile({
  owner,
  repo,
  branch,
  directory,
  filepath,
  throwErrors, // if true, raises errors on commit failure
  retries = 0,
}) {
  const filename = path.basename(filepath);

  const sha = await getFileSha({
    owner,
    repo,
    branch,
    directory,
    filename,
  });

  try {
    const apiParams = {
      owner,
      repo,
      branch,
      path: path.join(directory, filename),
      message: `Update ${filename}`,
      content: loadFileToBase64(filepath),
      sha,
      committer: {
        name: "deliberation-machine-user", // TODO: pull from env
        email: "james.p.houghton@gmail.com",
      },
      author: {
        name: "deliberation-machine-user",
        email: "james.p.houghton@gmail.com",
      },
    };

    // console.log("Committing file to github with params: ", apiParams);
    await octokit.rest.repos.createOrUpdateFileContents(apiParams);

    info(
      `File ${filename} committed to ${owner}/${repo}/${branch}/${directory}`,
    );
    // Todo: Add a check to see if the file was successfully committed?
    return true;
  } catch (e) {
    if (e.status === 409) {
      warn(
        `Conflict committing file ${filename} to repository ${owner}/${repo}/${branch}/${directory}, likely out-of-date sha`,
      );
    } else if (e.status === 422) {
      warn(`Missing SHA for file ${filename} in ${owner}/${repo}/${branch}`);
    } else {
      error(
        `Unknown Error committing file ${filename} to repository ${owner}/${repo}/${branch}/${directory}`,
        e,
      );
    }

    if (throwErrors) throw e;

    if (retries > 0) {
      info(`Retrying commit of ${filename} (${retries} tries left))`);
      const success = await commitFile({
        owner,
        repo,
        branch,
        directory,
        filepath,
        throwErrors, // if true, raises errors on commit failure
        retries: retries - 1,
      });
      return success;
    }

    error(
      `Failed to commit ${filename} to ${owner}/${repo}/${branch}/${directory}. No retries left.`,
      e,
    );
    return false;
  }
}

export async function pushPreregToGithub({ batch, delaySeconds = 60 }) {
  if (pushTimers.has("prereg")) return; // Push already queued

  const config = batch.get("validatedConfig");
  const repos = config?.preregRepos || [];
  const preregistrationDataFilename = batch.get("preregistrationDataFilename");

  const throttledPush = () => {
    pushTimers.delete("prereg");
    repos.forEach((repository) => {
      const { owner, repo, branch, directory } = repository;
      commitFile({
        owner,
        repo,
        branch,
        directory,
        filepath: preregistrationDataFilename,
        retries: 3,
      });
    });
  };

  info(`Pushing preregistration to github in ${delaySeconds} seconds`);
  pushTimers.set("prereg", setTimeout(throttledPush, delaySeconds * 1000));
}

export async function pushPostFlightReportToGithub({ batch }) {
  // Runs once on batch close; no throttling needed.
  const config = batch.get("validatedConfig");
  const repos = config?.preregRepos || [];
  const postFlightReportFilename = batch.get("postFlightReportFilename");

  repos.forEach((repository) => {
    const { owner, repo, branch, directory } = repository;
    commitFile({
      owner,
      repo,
      branch,
      directory,
      filepath: postFlightReportFilename,
      retries: 3,
    });
  });
}

export async function pushDataToGithub({
  batch,
  delaySeconds = 60,
  throwErrors,
}) {
  if (pushTimers.has("data")) return; // Push already queued

  const config = batch.get("validatedConfig");
  const dataRepos = config?.dataRepos || [];
  const scienceDataFilename = batch.get("scienceDataFilename");

  const throttledPush = async () => {
    pushTimers.delete("data");
    await Promise.all(
      dataRepos.map(async (dataRepo) => {
        const { owner, repo, branch, directory } = dataRepo;
        await commitFile({
          owner,
          repo,
          branch,
          directory,
          filepath: scienceDataFilename,
          throwErrors,
          retries: 3,
        });
      }),
    );
  };

  info(`Pushing data to github in ${delaySeconds} seconds`);
  if (delaySeconds === 0) {
    await throttledPush();
    return;
  }
  // when there is a delay in the push, we can't await success
  pushTimers.set("data", setTimeout(throttledPush, delaySeconds * 1000));
}

export async function validateConfigReposAccess({ config }) {
  try {
    // Read-only existence check (octokit.rest.git.getRef). Write
    // permissions are checked later during actual commit operations.
    const dataRepos = config?.dataRepos || [];
    const preregRepos = config?.preregRepos || [];

    const validations = [...dataRepos, ...preregRepos].map(
      ({ owner, repo, branch }) => validateRepoAccess({ owner, repo, branch }),
    );

    // Promise.all rejects on the first failed validation, causing batch
    // creation to fail with a clear error message.
    await Promise.all(validations);
    return true;
  } catch (e) {
    error("Error validating GitHub repository access: ", e);
    throw e;
  }
}
