# [YYYY-MM-DD] - [Investigation Title]

**Date**: YYYY-MM-DD
**Investigator**: @username or "Claude via @username"
**Status**: In Progress | Resolved | Deferred
**Related Issue**: #XXX

## Problem Statement

What issue are we investigating?

Include:
- Symptoms observed
- When/how the issue was discovered
- Impact on users or system functionality
- Frequency/reproducibility

## Hypothesis

What do we think is causing this?

Include:
- Initial theories
- Evidence supporting each hypothesis
- Which hypothesis we're testing first

## Investigation Steps

Document what you tried, in chronological order:

### Step 1: [Description]
**Date**: YYYY-MM-DD

What did you do?
```bash
# Commands run or code examined
```

**Result**: What did you find?

**Conclusion**: Does this support or refute the hypothesis?

### Step 2: [Description]
**Date**: YYYY-MM-DD

(Continue for each investigation step)

## Root Cause

What is actually causing the issue?

Include:
- The specific code, configuration, or system behavior responsible
- Why this happens (race condition, missing validation, integration issue, etc.)
- File references: `path/to/file.js:line`

## Solution

How did we fix it (or how should it be fixed)?

Include:
- The implemented fix or recommended approach
- Why this solution addresses the root cause
- PR implementing the fix: #XXX

## Prevention

How can we prevent this in the future?

Include:
- Tests added to catch this scenario
- Monitoring or logging improvements
- Code patterns to avoid
- Documentation updates needed

## Lessons Learned

What did we learn from this investigation?

Include:
- Unexpected findings
- Tools or techniques that were helpful
- Areas of the codebase that need improvement
- Things to watch for in the future

## References

- Related logs or error messages
- External documentation consulted
- Stack Overflow or GitHub issues referenced
- Related investigations: [Link to other devLog entries]
