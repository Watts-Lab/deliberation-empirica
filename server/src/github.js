import { Octokit } from "octokit";
import * as path from "path";
import * as fs from "fs";

const pushTimers = new Map();

const octokit = new Octokit({
  auth: process.env.DELIBERATION_MACHINE_USER_TOKEN,
});

export async function checkGithubAuth() {
  const result = await octokit.rest.rateLimit.get();
  const outcome = result?.data?.rate?.limit >= 5000 ? "succeeded" : "failed";
  const tokenTail = process.env.DELIBERATION_MACHINE_USER_TOKEN.slice(-4);
  console.log(`Github authentication ${outcome} with token ****${tokenTail}`);
  return result?.data?.rate?.limit >= 5000;
}

export async function getRepoTree({ owner, repo, branch }) {
  console.log("Getting repo tree ", owner, repo, branch);
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
    console.log("Error getting repo tree ", e);
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
    console.log("Error checking if file exists ", e);
    return undefined;
  }
}

function loadFileToBase64(filepath) {
  const file = fs.readFileSync(filepath);
  const base64 = file.toString("base64");
  return base64;
}

export async function commitFile({ owner, repo, branch, directory, filepath }) {
  const filename = path.basename(filepath);

  const sha = await getFileSha({
    owner,
    repo,
    branch,
    directory,
    filename,
  });

  try {
    const result = await octokit.rest.repos.createOrUpdateFileContents({
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

    console.log(
      `File ${filename} committed to ${owner}/${repo}/${branch}/${directory}`
    );
    // Todo: Add a check to see if the file was successfully committed?
    return true;
  } catch (e) {
    console.log(
      `Error committing file ${filename} to repository ${owner}/${repo}/${branch}/${directory}`,
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
      });
    });
    // Todo: Add treatment description file push to private repo
  };

  console.log(`Pushing preregistration to github in ${delaySeconds} seconds`);
  pushTimers.set("prereg", setTimeout(throttledPush, delaySeconds * 1000));
}

// Todo: could refactor this and the previous function into one function, and allow prereg pushes to private repo
export async function pushDataToGithub({ batch, delaySeconds = 60 }) {
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

  const throttledPush = () => {
    pushTimers.delete("data");

    // Push data to github each github repo specified in config, plus private repo if preregister is true
    dataRepos.forEach((dataRepo) => {
      // push to each repo in list
      const { owner, repo, branch, directory } = dataRepo;
      commitFile({
        owner,
        repo,
        branch,
        directory,
        filepath: scienceDataFilename,
      });
    });
  };

  console.log(`Pushing data to github in ${delaySeconds} seconds`);
  pushTimers.set("data", setTimeout(throttledPush, delaySeconds * 1000));
}
