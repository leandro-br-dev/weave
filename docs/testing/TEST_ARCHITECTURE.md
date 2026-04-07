# Test Architecture

This document provides a detailed explanation of the testing architecture used in the weave project.

## Table of Contents

1. [Overview](#overview)
2. [Test Directory Structure](#test-directory-structure)
3. [Test Categories and Types](#test-categories-and-types)
4. [Test Dependencies](#test-dependencies)
5. [Test Data Flow](#test-data-flow)
6. [Environment Setup](#environment-setup)
7. [Test Execution Flow](#test-execution-flow)
8. [Coverage Architecture](#coverage-architecture)

---

## Overview

The weave project uses a **multi-language testing strategy** with comprehensive coverage across Python and TypeScript codebases. The architecture is designed to:

- **Isolate test environments** from development and production
- **Provide fast feedback** through layered testing (unit → integration → E2E)
- **Ensure reliability** through proper fixtures and cleanup
- **Support parallel execution** for faster CI/CD pipelines
- **Maintain high coverage** across all modules

### Testing Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Python Tests** | pytest | Client library and integration tests |
| **TypeScript Tests** | vitest | API and dashboard tests |
| **Coverage Tools** | pytest-cov, vitest/coverage-v8 | Coverage tracking and reporting |
| **Test Helpers** | Custom fixtures and utilities | Shared test functionality |
| **Mocking** | unittest.mock, vi.mock | External service mocking |

---

## Test Directory Structure

```
weave/
├── tests/                          # Root-level test infrastructure
│   ├── conftest.py                 # Shared pytest configuration and fixtures
│   ├── templates/                  # Test templates for quick start
│   │   ├── python-unit-test.template.py
│   │   ├── python-integration-test.template.py
│   │   ├── typescript-unit-test.template.ts
│   │   ├── typescript-integration-test.template.ts
│   │   └── component-test.template.tsx
│   ├── examples/                   # Working test examples
│   │   ├── python-basic-example.test.py
│   │   ├── typescript-basic-example.test.ts
│   │   ├── integration-test-example.test.ts
│   │   └── api-test-example.test.ts
│   ├── fixtures/                   # Shared test data
│   │   ├── __init__.py
│   │   ├── sample_data.py          # Sample test data objects
│   │   └── test_scenarios.py       # Pre-built test scenarios
│   ├── helpers/                    # Test utility functions
│   │   ├── __init__.py
│   │   ├── db.py                   # Database test helpers
│   │   ├── assertions.py           # Custom assertion helpers
│   │   └── mocks.py                # Mock objects and factories
│   ├── unit/                       # Shared utility tests
│   ├── integration/                # Cross-component integration tests
│   │   ├── kanban/                 # Kanban integration tests
│   │   ├── test-data-factory.ts    # Test data factories
│   │   ├── vitest.config.ts        # Integration test vitest config
│   │   └── integration-setup.ts    # Integration test setup
│   └── e2e/                        # End-to-end workflow tests
│
├── api/                            # API server (TypeScript)
│   ├── tests/
│   │   ├── routes/                 # API route tests
│   │   │   ├── kanban.test.ts
│   │   │   └── plans.test.ts
│   │   ├── middleware/             # Middleware tests
│   │   ├── unit/                   # API utility tests
│   │   └── helpers/
│   │       ├── test-db.ts          # Database helpers
│   │       └── test-data-factory.ts # Test data factories
│   └── vitest.config.ts            # API vitest configuration
│
├── client/                         # Client library (Python)
│   ├── tests/
│   │   ├── test_daemon_client.py   # HTTP client tests
│   │   ├── test_planning_context.py # Planning context tests
│   │   ├── test_agents_context.py   # Agents context tests
│   │   ├── test_approval_flow.py    # Approval flow tests
│   │   ├── fixtures.py             # Client-specific fixtures
│   │   ├── conftest.py             # Client pytest configuration
│   │   ├── unit/                   # Client utility tests
│   │   └── integration/            # Client integration tests
│   │       ├── test_kanban_pipeline.py
│   │       └── test_kanban_planning.py
│   └── requirements.txt            # Test dependencies (pytest-cov, etc.)
│
├── dashboard/                      # Dashboard UI (TypeScript/React)
│   ├── tests/
│   │   ├── unit/                   # Utility and hook tests
│   │   ├── integration/            # Component integration tests
│   │   └── components/             # Individual component tests
│   └── vitest.config.ts            # Dashboard vitest configuration
│
├── scripts/
│   ├── testing/
│   │   ├── test-coverage.sh        # Combined coverage reporting
│   │   ├── test-runner.sh          # Unified test runner
│   │   ├── test-watch.sh           # Watch mode for tests
│   │   ├── run-integration-tests.sh # Integration test runner
│   │   └── test-kanban-endpoints.sh # Kanban API endpoint tests
│   └── setup/
│       ├── setup-test-env.sh       # Test environment setup
│       ├── teardown-test-env.sh    # Test environment cleanup
│       └── reset-test-db.sh        # Test database reset
│
├── .github/
│   └── workflows/
│       ├── test.yml                # Main test CI workflow
│       └── coverage.yml            # Coverage reporting workflow
│
├── pytest.ini                      # Root pytest configuration
├── .coveragerc                     # Python coverage configuration
└── package.json                    # Root npm scripts for testing
```

### Directory Purposes

#### `/tests` - Root Test Infrastructure
- **Purpose**: Shared test utilities, fixtures, and integration tests
- **Contains**: Templates, examples, helpers, and cross-component integration tests
- **Used by**: All test suites

#### `/api/tests` - API Tests
- **Purpose**: Test API endpoints, middleware, and business logic
- **Contains**: Route tests, middleware tests, API-specific helpers
- **Technology**: vitest + supertest

#### `/client/tests` - Client Library Tests
- **Purpose**: Test Python client library functionality
- **Contains**: HTTP client tests, context management, integration tests
- **Technology**: pytest

#### `/dashboard/tests` - Dashboard UI Tests
- **Purpose**: Test React components and UI interactions
- **Contains**: Component tests, hook tests, integration tests
- **Technology**: vitest + @testing-library/react

---

## Test Categories and Types

### Test Pyramid

```
                    ┌─────────────────┐
                    │   E2E Tests     │  ← Few, slow, comprehensive
                    │  (5-10%)        │
                    └─────────────────┘
                  ┌───────────────────────┐
                  │   Integration Tests   │  ← Some, medium speed
                  │     (20-30%)          │
                  └───────────────────────┘
               ┌────────────────────────────┐
               │       Unit Tests          │  ← Many, fast, focused
               │      (60-75%)             │
               └────────────────────────────┘
```

### Unit Tests

**Purpose**: Test individual functions, classes, and components in isolation

**Characteristics**:
- **Speed**: Very fast (milliseconds)
- **Dependencies**: Mocked or stubbed
- **Scope**: Single function, method, or component
- **Example**: Testing a utility function that formats dates

**Examples**:
```python
# Python unit test
def test_format_date_with_valid_input():
    result = format_date('2024-01-15')
    assert result == 'January 15, 2024'
```

```typescript
// TypeScript unit test
it('should format date correctly', () => {
  const result = formatDate('2024-01-15')
  expect(result).toBe('January 15, 2024')
})
```

### Integration Tests

**Purpose**: Test interactions between components and modules

**Characteristics**:
- **Speed**: Medium (seconds)
- **Dependencies**: Real or carefully mocked
- **Scope**: Multiple components working together
- **Example**: Testing API client with actual database

**Examples**:
```python
# Python integration test
def test_create_task_via_api():
    # Creates task via API, saves to database
    response = api_client.create_task('Test Task')
    task = db.get_task(response.id)
    assert task.title == 'Test Task'
```

```typescript
// TypeScript integration test
it('should create task and save to database', async () => {
  const response = await request(app)
    .post('/api/tasks')
    .send({ title: 'Test Task' })

  const task = db.getTask(response.body.id)
  expect(task.title).toBe('Test Task')
})
```

### End-to-End (E2E) Tests

**Purpose**: Test complete user workflows across the entire system

**Characteristics**:
- **Speed**: Slow (minutes)
- **Dependencies**: Real system (or close to real)
- **Scope**: Complete user workflows
- **Example**: Testing agent creation workflow from UI to API to database

**Examples**:
```python
# Python E2E test
def test_agent_creation_workflow():
    # 1. Create project via UI
    # 2. Add agent via API
    # 3. Verify in database
    # 4. Execute agent
    # 5. Verify results
```

### Test Type Distribution

| Test Type | Count | Execution Time | Coverage Focus |
|-----------|-------|----------------|----------------|
| **Unit Tests** | ~150+ | < 1 min | Code correctness |
| **Integration Tests** | ~40 | 2-3 min | Component interactions |
| **E2E Tests** | ~10 | 5-10 min | User workflows |
| **Total** | ~200+ | ~5-15 min | Full system validation |

---

## Test Dependencies

### Internal Dependencies

```
┌─────────────────────────────────────────────────────┐
│                    Test Suites                      │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────────┐      ┌────────────────────────┐   │
│  │ Unit Tests   │ ───▶ │ Test Fixtures & Helpers │   │
│  └──────────────┘      └────────────────────────┘   │
│           │                    ▲                     │
│           │                    │                     │
│           ▼                    │                     │
│  ┌──────────────────┐          │                     │
│  │ Integration Tests│ ──────────┘                     │
│  └──────────────────┘                                │
│           │                                          │
│           ▼                                          │
│  ┌─────────────────────────────────────────────┐    │
│  │           Shared Test Infrastructure         │    │
│  │  - conftest.py (pytest fixtures)             │    │
│  │  - vitest.config.ts (vitest config)          │    │
│  │  - helpers/* (test utilities)                │    │
│  │  - fixtures/* (test data)                    │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### External Dependencies

| Dependency | Type | Purpose | Test Usage |
|------------|------|---------|------------|
| **pytest** | Python | Test runner | Python tests |
| **pytest-cov** | Python | Coverage tool | Python coverage |
| **pytest-asyncio** | Python | Async support | Async Python tests |
| **vitest** | TypeScript | Test runner | TypeScript tests |
| **@vitest/coverage-v8** | TypeScript | Coverage tool | TypeScript coverage |
| **@testing-library/react** | TypeScript | Component testing | React tests |
| **supertest** | TypeScript | API testing | API route tests |
| **sqlite3** | Python | Test database | In-memory test DBs |
| **httpx** | Python | HTTP mocking | API client tests |
| **MSW** | TypeScript | API mocking | Browser API mocks |

### Dependency Management

#### Python Dependencies
```python
# client/requirements.txt (test dependencies)
pytest==7.4.3
pytest-cov==4.1.0
pytest-asyncio==0.21.1
pytest-timeout==2.2.0
pytest-xdist==3.5.0  # Parallel execution
httpx==0.25.2
```

#### TypeScript Dependencies
```json
// package.json (devDependencies)
{
  "vitest": "^1.0.0",
  "@vitest/coverage-v8": "^1.0.0",
  "@testing-library/react": "^14.1.2",
  "@testing-library/jest-dom": "^6.1.5",
  "@testing-library/user-event": "^14.5.1",
  "supertest": "^6.3.3",
  "msw": "^2.0.0"
}
```

---

## Test Data Flow

### Test Data Lifecycle

```
┌──────────────────────────────────────────────────────────┐
│                    Test Data Flow                        │
└──────────────────────────────────────────────────────────┘

1. SETUP PHASE
   ┌────────────────────────────────────────────┐
   │ Load test environment (.env.test)          │
   │ Create test database (in-memory SQLite)    │
   │ Initialize test fixtures                   │
   │ Seed test data (factories, fixtures)       │
   └────────────────────────────────────────────┘
                    │
                    ▼
2. EXECUTION PHASE
   ┌────────────────────────────────────────────┐
   │ Test reads test data from fixtures         │
   │ Test executes code with test data          │
   │ Test makes assertions on results           │
   │ Test logs failures/errors                  │
   └────────────────────────────────────────────┘
                    │
                    ▼
3. CLEANUP PHASE
   ┌────────────────────────────────────────────┐
   │ Cleanup test data (delete test records)    │
   │ Close database connections                 │
   │ Reset environment variables                │
   │ Remove temporary files                     │
   └────────────────────────────────────────────┘
```

### Test Data Factories

#### Python Test Data Factory

```python
# tests/fixtures/sample_data.py
from datetime import datetime

def create_test_project(overrides=None):
    """
    Create a test project with default values.

    Args:
        overrides: Dict of values to override defaults

    Returns:
        Dict with project data
    """
    defaults = {
        'id': f'test-project-{datetime.now().timestamp()}',
        'name': 'Test Project',
        'description': 'A test project',
        'settings': '{}'
    }
    if overrides:
        defaults.update(overrides)
    return defaults

def create_test_kanban_task(project_id, overrides=None):
    """Create a test kanban task with default values."""
    defaults = {
        'id': f'test-task-{datetime.now().timestamp()}',
        'project_id': project_id,
        'title': 'Test Task',
        'description': 'A test task',
        'column': 'backlog',
        'priority': 3,
        'pipeline_status': 'idle'
    }
    if overrides:
        defaults.update(overrides)
    return defaults
```

#### TypeScript Test Data Factory

```typescript
// tests/integration/test-data-factory.ts
export const testDataFactories = {
  project: (overrides = {}) => ({
    id: `test-project-${Date.now()}`,
    name: 'Test Project',
    description: 'A test project',
    settings: '{}',
    ...overrides
  }),

  kanbanTask: (projectId: string, overrides = {}) => ({
    id: `test-task-${Date.now()}`,
    projectId,
    title: 'Test Task',
    description: 'A test task',
    column: 'backlog',
    priority: 3,
    pipelineStatus: 'idle',
    ...overrides
  }),

  plan: (projectId: string, overrides = {}) => ({
    id: `test-plan-${Date.now()}`,
    projectId,
    name: 'Test Plan',
    tasks: JSON.stringify([]),
    status: 'pending',
    ...overrides
  })
}
```

### Test Data Isolation

#### Database Isolation
- **In-Memory SQLite**: Each test gets a fresh in-memory database
- **Transaction Rollback**: Tests run in transactions that are rolled back
- **Cleanup Scripts**: Automatic cleanup after test runs

#### File System Isolation
- **Temporary Directories**: Test files go to `/tmp/test-*` directories
- **Automatic Cleanup**: Temporary files removed after tests
- **Unique Names**: Test artifacts use unique names to avoid conflicts

#### Environment Isolation
- **Test Environment Variables**: Loaded from `.env.test` files
- **Port Isolation**: Test servers use different ports (3001 vs 3000)
- **Separate Configs**: Test-specific configuration files

---

## Environment Setup

### Test Environment Configuration

#### Python Test Environment

```bash
# tests/.env.test
TEST_DB_PATH=/tmp/weave-test.db
TEST_API_URL=http://localhost:3001
TEST_API_TOKEN=test-token-for-testing-only
TEST_PROJECTS_DIR=/tmp/test-projects
TEST_WORKSPACE_DIR=/tmp/test-workspaces
TEST_CLEANUP_ENABLED=true
TEST_TIMEOUT=30
```

#### API Test Environment

```bash
# api/.env.test
PORT=3001
DATABASE_URL=./api/data/test-database.db
API_BEARER_TOKEN=test-token-for-testing-only
NODE_ENV=test
```

#### Dashboard Test Environment

```bash
# dashboard/.env.test
VITE_API_URL=http://localhost:3001
VITE_API_TOKEN=test-token-for-testing-only
NODE_ENV=test
```

### Environment Loading

```python
# tests/conftest.py
import os
from pathlib import Path

def load_test_env():
    """Load test environment variables from .env.test file."""
    env_file = Path(__file__).parent / '.env.test'
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ.setdefault(key.strip(), value.strip())

load_test_env()
```

### Environment Reset

```python
# tests/conftest.py
@pytest.fixture(autouse=True)
def reset_environment():
    """
    Auto-use fixture to reset environment variables before each test.
    Ensures tests don't affect each other's environment.
    """
    # Store original environment
    original_env = os.environ.copy()

    # Reload test environment
    load_test_env()

    yield

    # Restore original environment
    os.environ.clear()
    os.environ.update(original_env)
```

---

## Test Execution Flow

### Local Test Execution

```
┌─────────────────────────────────────────────────┐
│            Developer runs tests                 │
└─────────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌──────────────┐       ┌──────────────┐
│   Python     │       │  TypeScript  │
│   Tests      │       │    Tests     │
│  (pytest)    │       │   (vitest)   │
└──────────────┘       └──────────────┘
        │                       │
        ▼                       ▼
┌──────────────┐       ┌──────────────┐
│ Load .env    │       │ Load .env    │
│ Run tests    │       │ Run tests    │
│ Collect cov  │       │ Collect cov  │
└──────────────┘       └──────────────┘
        │                       │
        └───────────┬───────────┘
                    ▼
        ┌──────────────────────┐
        │   Coverage Report    │
        │  (combined output)   │
        └──────────────────────┘
```

### CI Test Execution

```
┌─────────────────────────────────────────────────┐
│           GitHub Actions Trigger                │
│  (push, PR, manual workflow dispatch)           │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│        Install Dependencies                     │
│  - Python deps (pip install)                    │
│  - Node deps (npm ci)                           │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│        Setup Test Environment                   │
│  - Create test databases                        │
│  - Load test environment variables              │
│  - Start test services (if needed)              │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│        Run Tests in Parallel                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐│
│  │   Python   │  │    API     │  │ Dashboard  ││
│  │   Tests    │  │   Tests    │  │   Tests    ││
│  └────────────┘  └────────────┘  └────────────┘│
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│        Collect Coverage                         │
│  - Combine coverage from all modules            │
│  - Generate coverage reports                    │
│  - Check against thresholds                     │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│        Report Results                           │
│  - Post coverage to PR comments                 │
│  - Upload coverage to Codecov                   │
│  - Store artifacts (HTML reports)               │
│  - Fail CI if tests fail or coverage low        │
└─────────────────────────────────────────────────┘
```

### Test Execution Commands

#### Run All Tests
```bash
# All Python tests
pytest

# All TypeScript tests
npm test

# All tests (both)
npm run test:all
```

#### Run Specific Test Suites
```bash
# Python unit tests
pytest tests/unit/

# API tests
npm test --workspace=api

# Dashboard tests
npm test --workspace=dashboard

# Client tests
pytest client/tests/
```

#### Run with Coverage
```bash
# Python coverage
pytest --cov=client --cov-report=html

# TypeScript coverage
npm test -- --coverage

# Combined coverage
./scripts/testing/test-coverage.sh
```

#### Run in Watch Mode
```bash
# TypeScript watch mode
npm test -- --watch

# Python watch mode (requires pytest-xdist)
pytest-watch
```

---

## Coverage Architecture

### Coverage Configuration

#### Python Coverage (`.coveragerc`)

```ini
[run]
source = .
omit =
    */tests/*
    */venv/*
    */node_modules/*
    */__pycache__/*
    */migrations/*
branch = True

[report]
exclude_lines =
    pragma: no cover
    def __repr__
    if __name__ == .__main__.:
    if TYPE_CHECKING:
    raise NotImplementedError
    if __name__ == .__main__.:

[html]
directory = htmlcov-python

[xml]
output = coverage-python.xml

[json]
output = coverage-python.json
```

#### TypeScript Coverage (`vitest.config.ts`)

```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.config.ts',
        'dist/'
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70
      }
    }
  }
})
```

### Coverage Thresholds

| Module | Lines | Functions | Branches | Statements | Critical Path |
|--------|-------|-----------|----------|------------|---------------|
| **Python** | 70% | 70% | 65% | 70% | 80% |
| **API** | 70% | 70% | 70% | 70% | 80% |
| **Dashboard** | 70% | 70% | 65% | 70% | 75% |
| **Integration** | 60% | 60% | 55% | 60% | 70% |
| **Overall** | **70%** | **70%** | **65%** | **70%** | **75%** |

### Coverage Reports

#### Coverage Report Locations

```
coverage-reports/
├── htmlcov-python/           # Python HTML coverage report
│   └── index.html
├── coverage-api/             # API HTML coverage report
│   └── index.html
├── coverage-dashboard/       # Dashboard HTML coverage report
│   └── index.html
├── coverage-integration/     # Integration HTML coverage report
│   └── index.html
├── coverage-python.xml       # Python XML coverage (for CI)
├── coverage-python.json      # Python JSON coverage
├── coverage-summary.json     # Combined coverage summary
└── coverage-badge.svg        # Coverage badge
```

#### Coverage Collection Flow

```
┌─────────────────────────────────────────────────┐
│           Test Execution                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  Python  │  │   API    │  │Dashboard │      │
│  │  Tests   │  │  Tests   │  │  Tests   │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│        │            │            │              │
│        ▼            ▼            ▼              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │pytest-cov│  │vitest    │  │vitest    │      │
│  └──────────┘  └──────────┘  └──────────┘      │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│        Coverage Collection Script               │
│  (scripts/testing/test-coverage.sh)             │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│        Coverage Reports Generated                │
│  - HTML reports (browser-viewable)              │
│  - XML reports (CI integration)                 │
│  - JSON reports (data processing)               │
│  - Coverage badges                              │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│        Coverage Validation                       │
│  - Check against thresholds                     │
│  - Generate diff vs base branch                 │
│  - Post results to PR                           │
└─────────────────────────────────────────────────┘
```

---

## Conclusion

This test architecture provides:

1. **Comprehensive Coverage**: Tests at all levels (unit, integration, E2E)
2. **Fast Feedback**: Quick test execution for development
3. **Isolation**: Tests don't interfere with each other
4. **Maintainability**: Clear structure and shared utilities
5. **CI/CD Ready**: Automated testing and coverage reporting

For more information on:
- **Testing overview**: See [README.md](README.md)
- **Writing tests**: See [TEST_WRITING_GUIDE.md](guides/TEST_WRITING_GUIDE.md)
- **Test workflows**: See [TEST_WORKFLOWS.md](TEST_WORKFLOWS.md)
- **Test checklist**: See [TEST_CHECKLIST.md](TEST_CHECKLIST.md)
