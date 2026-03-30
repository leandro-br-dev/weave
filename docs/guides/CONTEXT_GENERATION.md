# Context Generation Feature - Quick Reference

## Overview
The Context Generation feature allows you to generate a comprehensive overview of a project, including its file structure, git information, and statistics. This context can be used to provide AI agents with better understanding of your codebase.

## Backend API Usage

### 1. Create/Update Environment with Git Repository

**Create Environment:**
```bash
curl -X POST "http://localhost:3100/api/projects/{projectId}/environments" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "production",
    "type": "local-wsl",
    "project_path": "/path/to/project",
    "git_repository": "https://github.com/username/repo"
  }'
```

**Update Environment:**
```bash
curl -X PUT "http://localhost:3100/api/projects/{projectId}/environments/{envId}" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "production",
    "type": "local-wsl",
    "project_path": "/path/to/project",
    "git_repository": "https://github.com/username/repo"
  }'
```

### 2. Generate Context

```bash
curl -X POST "http://localhost:3100/api/projects/{projectId}/environments/{envId}/generate-context" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "data": {
    "environment_id": "env-id",
    "project_path": "/path/to/project",
    "structure": {
      "type": "directory",
      "name": "project-name",
      "path": ".",
      "children": [...]
    },
    "git_info": {
      "is_git_repo": true,
      "branch": "main",
      "last_commit": {
        "hash": "abc123",
        "message": "Commit message"
      },
      "remote_url": "https://github.com/user/repo",
      "has_changes": false
    },
    "statistics": {
      "total_files": 150,
      "total_directories": 25
    },
    "languages": {
      "TypeScript": 45,
      "Python": 30,
      "JSON": 15
    }
  },
  "error": null
}
```

## Frontend Usage

### Using the Dashboard

1. **Navigate to Projects Page**
   - Open the dashboard in your browser
   - Go to the Projects page

2. **Locate Environment**
   - Find the project and environment you want to analyze
   - Look for the **FileTree icon button** (📁) next to the environment name

3. **Generate Context**
   - Click the FileTree icon button
   - A modal will appear showing loading state
   - Wait for context generation to complete (usually 2-5 seconds)

4. **View Results**
   - The modal will display:
     - **File Structure**: Tree view of project files
     - **Git Information**: Branch, last commit, remote URL
     - **Statistics**: Total files and directories
     - **Languages**: Breakdown of programming languages

### Using the Context Modal

The ContextModal component displays:
- **File Structure**: Formatted as a code block with dark theme
- **Git Information**: Clear labels for branch, commit, and remote
- **Statistics**: Visual cards with icons
- **Languages**: List with percentages (if available)

## Python Script Usage

### Direct Script Execution

```bash
cd api
python3 scripts/generate_project_context.py /path/to/project --output json
```

**Options:**
- `--output json`: Output as JSON (default)
- `--output text`: Output as human-readable text

**Example:**
```bash
python3 scripts/generate_project_context.py /root/projects/weave --output json 2>/dev/null | jq '.'
```

## What Gets Filtered

### Ignored Directories
- `node_modules`, `venv`, `.venv`, `__pycache__`
- `.git`, `dist`, `build`, `.next`, `.cache`
- `target`, `vendor`, `.npm`, `.yarn`
- `.idea`, `.vscode`, `coverage`, `.nyc_output`
- `tmp`, `temp`, `.tmp`

### Ignored Files
- `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`
- `*.min.js`, `*.min.css`, `*.map`
- `.DS_Store`, `Thumbs.db`

### Included File Extensions
- **Source Code**: `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.go`, `.rs`, `.java`
- **Configuration**: `.json`, `.yaml`, `.yml`, `.toml`, `.ini`
- **Documentation**: `.md`, `.txt`, `.rst`
- **Styles**: `.css`, `.scss`, `.sass`, `.less`
- **Scripts**: `.sh`, `.bash`, `.ps1`

## Integration with Planning Context

The generated context can be used in planning workflows:

```javascript
// Example: Using context in a planning agent
const context = await generateContext(projectPath);

const planningPrompt = `
You are working on a project with the following structure:

${JSON.stringify(context.structure, null, 2)}

Git Information:
- Branch: ${context.git_info.branch}
- Last Commit: ${context.git_info.last_commit.message}

Use this context to understand the codebase structure.
`;
```

## Troubleshooting

### Common Issues

**1. "Project path does not exist"**
- Verify the `project_path` in the environment is correct
- Check that the path is accessible from the API server

**2. "Context generation script not found"**
- Ensure `api/scripts/generate_project_context.py` exists
- Check file permissions on the script

**3. Empty file structure**
- Verify the project directory has files
- Check that file filters aren't too restrictive
- Ensure Python script has read permissions

**4. Git information missing**
- Confirm the project is a git repository
- Check that `.git` directory exists
- Verify git is installed on the system

**5. Timeout errors**
- Large projects may take longer to process
- Consider increasing the timeout in the API endpoint
- Current timeout: 30 seconds

## Best Practices

1. **Set Git Repository URL**
   - Always set `git_repository` when creating environments
   - Use HTTPS URLs for better compatibility
   - Format: `https://github.com/username/repo`

2. **Use Appropriate Paths**
   - Use absolute paths when possible
   - Ensure the API server can access the path
   - Test path accessibility before creating environment

3. **Regular Context Updates**
   - Regenerate context after major changes
   - Use the latest context for planning sessions
   - Cache results for frequently accessed projects

4. **Performance Considerations**
   - Large projects (>10k files) may take longer
   - Consider using specific subdirectories for large monorepos
   - Filter out unnecessary directories to speed up generation

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects/:id/environments` | Create environment with git_repository |
| PUT | `/api/projects/:id/environments/:envId` | Update environment git_repository |
| POST | `/api/projects/:id/environments/:envId/generate-context` | Generate project context |

## Related Files

- **Backend**: `/api/src/routes/projects.ts` (lines 552-625)
- **Python Script**: `/api/scripts/generate_project_context.py`
- **Frontend API**: `/dashboard/src/api/projects.ts`
- **Context Modal**: `/dashboard/src/components/ContextModal.tsx`
- **Projects Page**: `/dashboard/src/pages/ProjectsPage.tsx`

## Support

For issues or questions:
1. Check the test results in `TEST_RESULTS.md`
2. Review the endpoint documentation in `api/ENDPOINT_GENERATE_CONTEXT.md`
3. Check the Python script documentation in `api/scripts/README.md`

---

**Last Updated:** 2026-03-22
**Version:** 1.0.0
