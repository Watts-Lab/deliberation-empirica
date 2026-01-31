#!/bin/bash
# Usage: ./.github/scripts/post-merge.sh [BRANCH_NAME]
#
# This script cleans up after a PR has been merged:
# 1. Switches to main branch
# 2. Updates main from origin (fast-forward only)
# 3. Deletes the local feature branch
# 4. Optionally deletes the remote branch (if not auto-deleted)
#
# If BRANCH_NAME is not provided, uses the current branch

set -e

# Determine which branch to clean up
if [ -z "$1" ]; then
    # No argument provided, use current branch
    BRANCH_NAME=$(git branch --show-current)

    if [ "$BRANCH_NAME" = "main" ]; then
        echo "Error: Cannot run cleanup from main branch without specifying a branch name"
        echo "Usage: $0 [BRANCH_NAME]"
        exit 1
    fi

    echo "Cleaning up current branch: ${BRANCH_NAME}"
else
    BRANCH_NAME=$1
    echo "Cleaning up branch: ${BRANCH_NAME}"
fi

# Safety check: don't delete main
if [ "$BRANCH_NAME" = "main" ]; then
    echo "Error: Cannot delete main branch"
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "Error: Not in a git repository"
    exit 1
fi

# Check if branch exists locally
if ! git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}"; then
    echo "Error: Branch '${BRANCH_NAME}' does not exist locally"
    exit 1
fi

echo ""
echo "Post-merge cleanup for: ${BRANCH_NAME}"
echo ""

# Switch to main if we're on the feature branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "$BRANCH_NAME" ]; then
    echo "Switching to main branch..."
    git checkout main
fi

# Update main from origin
echo "Updating main from origin..."
git pull --ff-only

# Delete local branch
echo "Deleting local branch: ${BRANCH_NAME}"
git branch -d "${BRANCH_NAME}"

# Check if remote branch exists
if git ls-remote --exit-code --heads origin "${BRANCH_NAME}" >/dev/null 2>&1; then
    echo ""
    echo "Remote branch 'origin/${BRANCH_NAME}' still exists."
    read -p "Do you want to delete it? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Deleting remote branch..."
        git push origin --delete "${BRANCH_NAME}"
        echo "Remote branch deleted."
    else
        echo "Remote branch kept. You can delete it later with:"
        echo "  git push origin --delete ${BRANCH_NAME}"
    fi
else
    echo "Remote branch was already deleted (likely auto-deleted by GitHub)."
fi

echo ""
echo "========================================="
echo "Cleanup complete!"
echo "Current branch: main (up to date)"
echo "Deleted local branch: ${BRANCH_NAME}"
echo "========================================="
