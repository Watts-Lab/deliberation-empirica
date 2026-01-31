#!/bin/bash
# Usage: ./.github/scripts/start-issue.sh ISSUE_NUMBER
#
# This script helps start work on a GitHub issue by:
# 1. Ensuring main branch is up to date
# 2. Creating a new feature branch named after the issue
# 3. Providing the issue details for context

set -e

# Check if issue number is provided
if [ -z "$1" ]; then
    echo "Error: Issue number required"
    echo "Usage: $0 ISSUE_NUMBER"
    exit 1
fi

ISSUE_NUM=$1

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI (gh) is not installed"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "Error: Not in a git repository"
    exit 1
fi

# Fetch issue details
echo "Fetching issue #${ISSUE_NUM}..."
ISSUE_TITLE=$(gh issue view $ISSUE_NUM --json title -q .title 2>/dev/null)

if [ -z "$ISSUE_TITLE" ]; then
    echo "Error: Could not fetch issue #${ISSUE_NUM}"
    echo "Make sure the issue exists and you have access to it"
    exit 1
fi

# Create branch name from issue title
# Format: issue-{number}-{slugified-title}
# Max 60 characters to keep branch names reasonable
BRANCH_NAME="issue-${ISSUE_NUM}-$(echo "$ISSUE_TITLE" | \
    tr '[:upper:]' '[:lower:]' | \
    sed 's/[^a-z0-9]/-/g' | \
    sed 's/--*/-/g' | \
    sed 's/^-//' | \
    sed 's/-$//' | \
    cut -c1-50)"

echo ""
echo "Issue: #${ISSUE_NUM} - ${ISSUE_TITLE}"
echo "Branch: ${BRANCH_NAME}"
echo ""

# Update main branch
echo "Updating main branch..."
git checkout main
git pull --ff-only

# Check if branch already exists
if git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}"; then
    echo ""
    echo "Warning: Branch '${BRANCH_NAME}' already exists"
    read -p "Do you want to check it out anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted"
        exit 1
    fi
    git checkout "${BRANCH_NAME}"
else
    # Create and checkout new branch
    echo "Creating branch: ${BRANCH_NAME}"
    git checkout -b "${BRANCH_NAME}"
fi

# Display issue details
echo ""
echo "========================================="
echo "Issue Details:"
echo "========================================="
gh issue view $ISSUE_NUM

echo ""
echo "========================================="
echo "Ready to work on issue #${ISSUE_NUM}!"
echo "Branch: ${BRANCH_NAME}"
echo ""
echo "When done, create a PR with:"
echo "  gh pr create --fill"
echo "========================================="
