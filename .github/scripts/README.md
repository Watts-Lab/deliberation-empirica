# Workflow Scripts

This directory contains scripts to streamline the GitHub workflow for this repository.

## Available Scripts

### `start-issue.sh`

Starts work on a GitHub issue by creating a feature branch and displaying issue details.

**Usage:**
```bash
./.github/scripts/start-issue.sh ISSUE_NUMBER
```

**What it does:**
1. Fetches issue details from GitHub
2. Ensures main branch is up to date (`git pull --ff-only`)
3. Creates a new branch named `issue-{number}-{slugified-title}`
4. Displays the full issue description for context
5. Provides next steps for creating a PR

**Requirements:**
- GitHub CLI (`gh`) installed and authenticated
- Must be run from repository root

**Example:**
```bash
./.github/scripts/start-issue.sh 42
# Creates branch: issue-42-add-dark-mode-toggle
# Shows issue details
# Ready to start coding
```

### `post-merge.sh`

Cleans up local and remote branches after a PR has been merged.

**Usage:**
```bash
# From the feature branch:
./.github/scripts/post-merge.sh

# Or specify a branch explicitly:
./.github/scripts/post-merge.sh issue-42-add-dark-mode
```

**What it does:**
1. Switches to main branch (if on feature branch)
2. Updates main from origin (`git pull --ff-only`)
3. Deletes the local feature branch
4. Optionally deletes the remote branch (prompts user)

**Requirements:**
- Must be run from repository root
- Branch to delete must exist locally

**Example:**
```bash
# After PR is merged on GitHub:
./.github/scripts/post-merge.sh
# Switches to main
# Updates from origin
# Deletes feature branch
```

## Typical Workflow

1. **Start work on an issue:**
   ```bash
   ./.github/scripts/start-issue.sh 123
   ```

2. **Make changes, commit, push:**
   ```bash
   git add .
   git commit -m "feat: implement feature"
   git push -u origin issue-123-feature-name
   ```

3. **Create PR:**
   ```bash
   gh pr create --fill
   # Or use: gh pr create --web
   ```

4. **After PR is merged:**
   ```bash
   ./.github/scripts/post-merge.sh
   ```

## For AI Agents

When automating workflows:

1. **Starting work:** Always use `start-issue.sh` to ensure consistent branch naming and up-to-date main branch
2. **Creating PRs:** Follow the [PR template](../.github/pull_request_template.md) and link to any relevant devLog entries
3. **Post-merge:** Run `post-merge.sh` automatically (with `-y` flag if added) to keep the repository clean

## Future Enhancements

Potential additions:
- `create-pr.sh` - Automate PR creation with filled template
- `update-branch.sh` - Rebase feature branch on latest main
- `run-checks.sh` - Run all CI checks locally before pushing
