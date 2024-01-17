import { Octokit } from "octokit";
import * as path from "path";
import * as fs from "fs";
import { error, warn, info } from "@empirica/core/console";

const pushTimers = new Map();

const octokit = new Octokit({
  auth: process.env.DELIBERATION_MACHINE_USER_TOKEN,
});

export async function checkGithubAuth() {
  const result = await octokit.rest.rateLimit.get();
  const tokenTail = process.env.DELIBERATION_MACHINE_USER_TOKEN.slice(-4);

  if (result?.data?.rate?.limit < 5000) {
    throw new Error(`Github authentication failed with token ****${tokenTail}`);
  }

  info(`Github authentication succeeded with token ****${tokenTail}`);
}

export async function getRepoTree({ owner, repo, branch }) {
  info("Getting repo tree ", owner, repo, branch);
  try {
    const result = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    const { sha } = result.data.object;
    const tree = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: sha,
      recursive: 1,
    });
    return tree.data.tree;
  } catch (e) {
    error("Error getting repo tree ", e);
  }
  return [];
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
    await octokit.rest.repos.createOrUpdateFileContents({
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
    });

    info(
      `File ${filename} committed to ${owner}/${repo}/${branch}/${directory}`
    );
    // Todo: Add a check to see if the file was successfully committed?
    return true;
  } catch (e) {
    if (e.status === 409) {
      warn(
        `Conflict committing file ${filename} to repository ${owner}/${repo}/${branch}/${directory}, likely out-of-date sha`
      );
    } else if (e.status === 422) {
      warn(`Missing SHA for file ${filename} in ${owner}/${repo}/${branch}`);
    } else {
      error(
        `Unknown Error committing file ${filename} to repository ${owner}/${repo}/${branch}/${directory}`,
        e
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
      e
    );
    return false;
  }
}

export async function pushPreregToGithub({ batch, delaySeconds = 60 }) {
  if (pushTimers.has("prereg")) return; // Push already queued

  const { config } = batch.get("config");
  const repos = config?.preregRepos || [];
  const preregister = config?.preregister || false;
  const preregistrationDataFilename = batch.get("preregistrationDataFilename");

  if (preregister) {
    repos.push({
      owner: process.env.GITHUB_PUBLIC_DATA_OWNER,
      repo: process.env.GITHUB_PUBLIC_DATA_REPO,
      branch: process.env.GITHUB_PUBLIC_DATA_BRANCH,
      directory: "preregistration",
    });
  }

  const throttledPush = () => {
    pushTimers.delete("prereg");

    // Push data to github each github repo specified in config, plus public repo if preregister is true
    repos.forEach((repository) => {
      // push to each repo in list
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
    // Todo: Add treatment description file push to private repo
  };

  info(`Pushing preregistration to github in ${delaySeconds} seconds`);
  pushTimers.set("prereg", setTimeout(throttledPush, delaySeconds * 1000));
}

export async function pushPostFlightReportToGithub({ batch }) {
  // runs once, so no need to throttle
  // pushes post flight report to same folder as preregistration
  const { config } = batch.get("config");
  const repos = config?.preregRepos || [];
  const preregister = config?.preregister || false;
  const postFlightReportFilename = batch.get("postFlightReportFilename");

  if (preregister) {
    repos.push({
      owner: process.env.GITHUB_PUBLIC_DATA_OWNER,
      repo: process.env.GITHUB_PUBLIC_DATA_REPO,
      branch: process.env.GITHUB_PUBLIC_DATA_BRANCH,
      directory: "preregistration",
    });
  }

  // Push data to github each github repo specified in config, plus public repo if preregister is true
  repos.forEach((repository) => {
    // push to each repo in list
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
  // Todo: Add treatment description file push to private repo
}

// Todo: could refactor this and the previous function into one function, and allow prereg pushes to private repo
export async function pushDataToGithub({
  batch,
  delaySeconds = 60,
  throwErrors,
}) {
  if (pushTimers.has("data")) return; // Push already queued

  const { config } = batch.get("config");
  const dataRepos = config?.dataRepos;
  const preregister = config?.preregister || false;
  const scienceDataFilename = batch.get("scienceDataFilename");

  if (preregister) {
    dataRepos.push({
      owner: process.env.GITHUB_PRIVATE_DATA_OWNER,
      repo: process.env.GITHUB_PRIVATE_DATA_REPO,
      branch: process.env.GITHUB_PRIVATE_DATA_BRANCH,
      directory: "scienceData",
    });
  }

  const throttledPush = async () => {
    pushTimers.delete("data");
    // Push data to github each github repo specified in config, plus private repo if preregister is true
    await Promise.all(
      dataRepos.map(async (dataRepo) => {
        // push to each repo in list
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
      })
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
