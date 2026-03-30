# API Tests

Test suite for the weave API.

## Directory Structure

```
api/tests/
├── unit/          # Unit tests for API utilities and helpers
├── integration/   # Integration tests for API endpoints
├── middleware/    # Tests for API middleware
└── routes/        # Tests for individual route handlers
```

## Running Tests

### Run All API Tests
```bash
# From the api directory
npm test

# From the root
npm test --workspace=api
```

### Run Specific Test Suites
```bash
# Unit tests
npm test -- api/tests/unit/

# Integration tests
npm test -- api/tests/integration/

# Route tests
npm test -- api/tests/routes/
```

### Run with Coverage
```bash
npm test -- --coverage
```

## Test Organization

- **Unit tests**: Test individual utilities, helpers, and functions in isolation
- **Integration tests**: Test API endpoints with database interactions
- **Middleware tests**: Test authentication, logging, error handling
- **Route tests**: Test individual route handlers and their responses

## Setup

Tests require:
- PostgreSQL database running (for integration tests)
- Environment variables set (see `.env.test`)
- Test fixtures loaded (if needed)

## Configuration

Test configuration is in `vitest.config.ts` and `.env.test`.

## Naming Conventions

- Test files: `<name>.test.ts`
- Test suites: `describe('<FeatureName>', ...)`
- Test cases: `it('should <do something>', ...)`
