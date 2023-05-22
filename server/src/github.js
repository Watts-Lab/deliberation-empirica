import { Octokit } from "octokit";
import * as path from "path";
import * as fs from "fs";

if (!process.env.DELIBERATION_MACHINE_USER_TOKEN)
  console.log(
    "No github token found in .env for DELIBERATION_MACHINE_USER_TOKEN"
  );

const octokit = new Octokit({
  auth: process.env.DELIBERATION_MACHINE_USER_TOKEN,
});

async function getRateLimit() {
  const result = await octokit.rest.rateLimit.get();
  console.log("Github API Rate limit ", result.data);
}
getRateLimit();

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
    console.log("Check if file exists ", result);
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
    const result = octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      branch,
      path: path.join(directory, filename),
      message: `Update ${filename}`,
      content: loadFileToBase64(filepath),
      sha,
      committer: {
        name: "deliberation-machine-user",
        email: "james.p.houghton@gmail.com",
      },
      author: {
        name: "deliberation-machine-user",
        email: "james.p.houghton@gmail.com",
      },
    });

    console.log(`Committing file ${filename} to ${owner}/${repo}/${branch}`);
    return result.status === 200;
  } catch (e) {
    console.log("Error committing file ", e);
    return false;
  }
}
