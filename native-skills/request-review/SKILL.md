---
name: request-review
description: >
  Request user review/validation during task execution. Use when you have completed
  implementation and need the user to verify the work before proceeding. The agent
  will pause until the user responds. Supports approval, denial with reason, and
  auto-approve for subsequent corrections.
---

# Request User Review

Request user validation of your work before proceeding to the next phase (commit, PR, deployment, etc).

## When to Use

- After completing implementation changes
- Before committing or opening a PR
- When you need the user to verify your work
- After fixing issues from a previous denial (unless auto-approve was set)

## How to Request Review

Run this command via Bash:

```bash
__review_task__ {"summary": "Brief description of changes", "files_changed": ["path/to/file1", "path/to/file2"], "details": "What changed and what to verify"}
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `summary` | Yes | One-line description of what was done |
| `files_changed` | Yes | Array of file paths that were modified or created |
| `details` | No | Extended context: decisions made, test results, what to verify |

## Response Handling

### REVIEW_APPROVED

```
REVIEW_APPROVED: <optional notes from reviewer>
```

- If `notes` are present, apply any observations or corrections mentioned
- If notes are empty, proceed with the workflow

### REVIEW_DENIED

```
REVIEW_DENIED: <denial_reason>. Notes: <optional notes>. Auto-approve: <true/false>
```

- Read the `denial_reason` carefully
- Fix the issues described in the denial reason
- If `auto_approve` is **true**: fix and proceed directly (no need for another review)
- If `auto_approve` is **false**: fix and request another review via `__review_task__`

## Important Notes

- The agent **PAUSES** until the user responds — no timeout is counted during this phase
- Always provide a clear summary and comprehensive list of changed files
- Include testing results in the details when possible
- Use `__ask_user__` for questions/credentials — use `__review_task__` for review/validation only
