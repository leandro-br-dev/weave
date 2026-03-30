# Environment Variables API

## Overview

The Environment Variables API provides a centralized way to manage global environment variables that can be used as defaults when creating new agents and environments.

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS environment_variables (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'general',
  is_secret INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## API Endpoints

### GET /api/environment-variables

List all environment variables.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "key": "ANTHROPIC_BASE_URL",
      "value": "http://localhost:8083",
      "description": "Base URL for Anthropic API",
      "category": "api",
      "is_secret": false,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "error": null
}
```

### GET /api/environment-variables/:id

Get a single environment variable by ID.

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "key": "ANTHROPIC_BASE_URL",
    "value": "http://localhost:8083",
    "description": "Base URL for Anthropic API",
    "category": "api",
    "is_secret": false,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  },
  "error": null
}
```

### POST /api/environment-variables

Create a new environment variable.

**Request Body:**
```json
{
  "key": "ANTHROPIC_BASE_URL",
  "value": "http://localhost:8083",
  "description": "Base URL for Anthropic API",
  "category": "api",
  "is_secret": false
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "key": "ANTHROPIC_BASE_URL",
    "value": "http://localhost:8083",
    "description": "Base URL for Anthropic API",
    "category": "api",
    "is_secret": false,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  },
  "error": null
}
```

### PUT /api/environment-variables/:id

Update an existing environment variable.

**Request Body:**
```json
{
  "key": "ANTHROPIC_BASE_URL",
  "value": "http://localhost:8083/v2",
  "description": "Base URL for Anthropic API (updated)",
  "category": "api",
  "is_secret": false
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "key": "ANTHROPIC_BASE_URL",
    "value": "http://localhost:8083/v2",
    "description": "Base URL for Anthropic API (updated)",
    "category": "api",
    "is_secret": false,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:10:00.000Z"
  },
  "error": null
}
```

### DELETE /api/environment-variables/:id

Delete an environment variable.

**Response:**
```json
{
  "data": {
    "id": "uuid"
  },
  "error": null
}
```

### POST /api/environment-variables/batch

Batch create or update environment variables.

**Request Body:**
```json
{
  "variables": [
    {
      "key": "MODEL_NAME",
      "value": "claude-3-5-sonnet-20241022",
      "description": "Default model name",
      "category": "model",
      "is_secret": false
    },
    {
      "key": "MAX_TOKENS",
      "value": "8192",
      "description": "Maximum tokens for responses",
      "category": "general",
      "is_secret": false
    }
  ]
}
```

**Response:**
```json
{
  "data": [
    {
      "key": "MODEL_NAME",
      "id": "uuid",
      "action": "created"
    },
    {
      "key": "MAX_TOKENS",
      "id": "uuid",
      "action": "created"
    }
  ],
  "error": null
}
```

### GET /api/environment-variables/categories

Get all unique categories.

**Response:**
```json
{
  "data": ["api", "general", "model", "security"],
  "error": null
}
```

### GET /api/environment-variables/by-category/:category

Get environment variables filtered by category.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "key": "ANTHROPIC_BASE_URL",
      "value": "http://localhost:8083",
      "description": "Base URL for Anthropic API",
      "category": "api",
      "is_secret": false,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "error": null
}
```

## Usage in Agent Creation

When creating a new environment, the global environment variables are automatically loaded as defaults in the `settings.local.json` file:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:8083",
    "API_TIMEOUT_MS": "3000000",
    "MODEL_NAME": "claude-3-5-sonnet-20241022",
    "MAX_TOKENS": "8192"
  },
  "permissions": {
    "allow": ["Read", "Edit", "Write", "Bash", "Glob"],
    "deny": [],
    "additionalDirectories": ["/path/to/project"]
  }
}
```

## Categories

Environment variables can be organized into categories for better management:

- **general**: General configuration variables
- **api**: API-related settings (URLs, endpoints, etc.)
- **model**: Model configuration (model names, parameters, etc.)
- **security**: Security-related variables (API keys, tokens, etc.)
- **custom**: Any custom category you need

## Security

- Variables marked with `is_secret: true` should be handled with care
- The API does not mask secret values in responses, so frontend should handle masking
- Consider implementing additional security measures for production use

## Testing

Run the test script to verify the API:

```bash
cd /root/projects/weave/api
node test-env-vars.js
```

## Future Enhancements

Potential improvements for the future:

1. **Variable Validation**: Add validation rules for specific variable types (URLs, numbers, etc.)
2. **Variable Encryption**: Encrypt secret values in the database
3. **Variable Inheritance**: Support project-specific overrides of global variables
4. **Variable Templates**: Create templates for common configurations
5. **Variable Versioning**: Track changes to variables over time
6. **Variable Export/Import**: Bulk export and import functionality
7. **Variable Masking**: Mask secret values in API responses
8. **Variable Scopes**: Support for workspace, project, and global scopes
