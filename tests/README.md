# Tests Directory

This directory contains all tests for the weave system, including unit tests, integration tests, end-to-end tests, and specialized test scripts.

## Directory Structure

```
tests/
├── unit/                # Unit tests for shared utilities and libraries
├── integration/         # Integration tests across multiple components
├── e2e/                # End-to-end tests of complete workflows
├── fixtures/           # Shared test data and fixtures
├── helpers/            # Test utilities and helper functions
└── scripts/            # Specialized test scripts and workflows
    ├── e2e/           # End-to-end shell script tests
    ├── workflow/      # Workflow automation tests
    ├── manual/        # Manual testing guides
    └── legacy/        # Archived test scripts (reference only)
```

## Test Scripts Organization

The `tests/scripts/` directory contains organized test scripts:

### **e2e/** - Comprehensive End-to-End Tests
- `test-improvement-comprehensive.sh` - Consolidated E2E test suite (11 tests)
  - Tests complete improvement workflows
  - Validates workspace selection, file operations, error handling
  - Run with: `npm run test:e2e` or `make test-e2e`

### **workflow/** - Workflow-Specific Tests
- `test-improvement-workflow.sh` - Tests improvement workflow execution
- `test-structured-output-race-condition.sh` - Tests timing edge cases
- `test-structured-output-fix.sh` - Tests format normalization
- Run with: `npm run test:workflow` or `make test-workflow`

### **manual/** - Manual Testing Guides
- `test-improvement-manual.sh` - Interactive manual testing guide
- Run with: `npm run test:manual` or `make test-manual`

### **legacy/** - Archived Tests
- Contains deprecated test scripts archived for reference
- See `tests/scripts/legacy/README.md` for archive documentation
- Run with: `npm run test:legacy` or `make test-legacy` (not recommended)

## Running Tests

### Run All Tests
```bash
# Using npm scripts
npm test

# Using make
make test

# Python tests (pytest)
pytest tests/

# TypeScript tests (vitest)
npm test -- tests/
```

### Run Specific Test Suites
```bash
# Unit tests only
npm run test:python:unit
pytest tests/unit/

# Integration tests only
npm run test:python:integration
pytest tests/integration/

# E2E tests only
npm run test:e2e
make test-e2e

# Workflow tests
npm run test:workflow
make test-workflow

# All script-based tests
npm run test:scripts
make test-scripts

# Manual testing guide
npm run test:manual
make test-manual
```

### Run Tests by Type
```bash
# Python tests
npm run test:python
make test-python

# API tests
npm run test:api
make test-api

# Dashboard tests
npm run test:dashboard
make test-dashboard

# Integration tests
npm run test:integration
make test-integration
```

### Coverage Reports
```bash
# Generate all coverage reports
npm run test:coverage
make test-coverage

# Python coverage
npm run test:python:coverage

# API coverage
npm run test:api:coverage

# Dashboard coverage
npm run test:dashboard:coverage
```

## Naming Conventions

- Test files: `test_<name>.py` or `<name>.test.ts`
- Test classes: `Test<FeatureName>`
- Test functions: `test_<specific_scenario>`
- Test scripts: `test-<category>-<name>.sh`

## Test Organization

- **Unit tests**: Test individual functions and classes in isolation
- **Integration tests**: Test interactions between multiple components
- **E2E tests**: Test complete user workflows and scenarios
- **Script tests**: Shell-based tests for workflows and automation
- **Manual tests**: Interactive guides for exploratory testing

## Documentation

For detailed testing documentation, see:
- **Test Organization Guide**: `docs/testing/test-organization.md`
- **Test Inventory**: `docs/testing/test-inventory.md`
- **Migration Log**: `docs/testing/test-migration-log.md`
- **Legacy Tests**: `tests/scripts/legacy/README.md`

## Test Configuration

- **Python**: Configured in `pytest.ini`
- **TypeScript**: Configured in `vitest.config.ts`
- **Scripts**: Configured in `package.json` and `Makefile`
