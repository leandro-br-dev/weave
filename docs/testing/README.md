# Testing Documentation

Complete testing documentation suite for the weave project.

## Quick Start

```bash
# Run all tests
npm run test:all

# Run Python tests only
pytest

# Run TypeScript tests only
npm test

# Run with coverage
./scripts/coverage-report.sh
```

## Documentation Index

### Core Testing Docs

| Document | Purpose |
|----------|---------|
| [TEST_ARCHITECTURE.md](TEST_ARCHITECTURE.md) | Test directory structure, categories, dependencies, data flow, and coverage architecture |
| [TEST_WORKFLOWS.md](TEST_WORKFLOWS.md) | Development workflows (TDD, feature dev, bug fix), pre-commit testing, CI/CD pipeline, debugging |
| [TEST_CHECKLIST.md](TEST_CHECKLIST.md) | Pre-commit, pre-PR, pre-release, test quality, coverage, and CI/CD checklists |
| [TEST_WRITING_GUIDE.md](guides/TEST_WRITING_GUIDE.md) | Best practices for writing tests (Python, TypeScript, integration, naming, mocking) |

### Feature-Specific Test Docs

| Document | Purpose |
|----------|---------|
| [TEST_RUNNER_GUIDE.md](TEST_RUNNER_GUIDE.md) | Completion detection system test runner (10 integration tests) |
| [E2E_TEST_PLAN.md](E2E_TEST_PLAN.md) | End-to-end test plan for the completion detection system |

## Testing Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Python Tests | pytest | Client library and integration tests |
| TypeScript Tests | vitest | API and dashboard tests |
| Coverage | pytest-cov, vitest/coverage-v8 | Coverage tracking and reporting |

## Test Structure

```
weave/
├── tests/                    # Root-level test infrastructure
│   ├── conftest.py           # Shared pytest configuration
│   ├── templates/            # Test templates
│   ├── examples/             # Working test examples
│   ├── fixtures/             # Shared test data
│   ├── helpers/              # Test utilities
│   ├── unit/                 # Shared utility tests
│   ├── integration/          # Cross-component tests
│   └── e2e/                  # End-to-end workflow tests
├── api/tests/                # API route and middleware tests
├── client/tests/             # Python client library tests
└── dashboard/tests/          # React component tests
```

## Coverage Thresholds

| Module | Lines | Functions | Branches | Statements |
|--------|-------|-----------|----------|------------|
| Python | 70% | 70% | 65% | 70% |
| API | 70% | 70% | 70% | 70% |
| Dashboard | 70% | 70% | 65% | 70% |
| Overall | **70%** | **70%** | **65%** | **70%** |

## Test Pyramid

```
          ┌──────────────┐
          │  E2E Tests   │  ← Few, slow, comprehensive (5-10%)
          └──────────────┘
        ┌──────────────────┐
        │ Integration Tests│  ← Some, medium speed (20-30%)
        └──────────────────┘
      ┌──────────────────────┐
      │     Unit Tests        │  ← Many, fast, focused (60-75%)
      └──────────────────────┘
```
