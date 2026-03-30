# Dashboard Tests

Test suite for the weave dashboard UI.

## Directory Structure

```
dashboard/tests/
├── unit/          # Unit tests for utilities, hooks, and helpers
├── integration/   # Integration tests for component interactions
└── components/    # Component tests for UI elements
```

## Running Tests

### Run All Dashboard Tests
```bash
# From the dashboard directory
npm test

# From the root
npm test --workspace=dashboard
```

### Run Specific Test Suites
```bash
# Unit tests
npm test -- dashboard/tests/unit/

# Integration tests
npm test -- dashboard/tests/integration/

# Component tests
npm test -- dashboard/tests/components/
```

### Run with Coverage
```bash
npm test -- --coverage
```

### Run in Watch Mode
```bash
npm test -- --watch
```

## Test Organization

- **Unit tests**: Test utilities, hooks, and helper functions in isolation
- **Integration tests**: Test component interactions and integration with APIs
- **Component tests**: Test individual UI components and their behavior

## Setup

Tests require:
- Node.js environment
- Test dependencies installed
- Mock API responses configured

## Configuration

Test configuration is in `vitest.config.ts`.

## Naming Conventions

- Test files: `<name>.test.ts` or `<name>.test.tsx`
- Test suites: `describe('<ComponentName>', ...)`
- Test cases: `it('should <do something>', ...)`
