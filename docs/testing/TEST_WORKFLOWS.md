# Test Workflows

This document describes the recommended workflows for testing during development, before committing, and in CI/CD.

## Table of Contents

1. [Development Workflow](#development-workflow)
2. [Pre-Commit Testing](#pre-commit-testing)
3. [CI/CD Testing Pipeline](#cicd-testing-pipeline)
4. [Debugging Failing Tests](#debugging-failing-tests)
5. [Performance Testing](#performance-testing)
6. [Test Maintenance](#test-maintenance)

---

## Development Workflow

### Test-Driven Development (TDD)

**Recommended workflow for new features:**

```
┌─────────────────────────────────────────────────┐
│          1. Write Test First                     │
│  - Write failing test for new feature           │
│  - Run test to confirm it fails                 │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│          2. Implement Feature                    │
│  - Write minimal code to make test pass          │
│  - Run test to confirm it passes                 │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│          3. Refactor                             │
│  - Improve code quality                          │
│  - Run tests to ensure nothing broke             │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│          4. Repeat                               │
│  - Add more test cases for edge cases            │
│  - Continue until feature is complete            │
└─────────────────────────────────────────────────┘
```

#### TDD Example

```bash
# 1. Write test first
cat > tests/test_new_feature.py << 'EOF'
def test_new_feature():
    result = new_function()
    assert result == "expected"
EOF

# 2. Run test to confirm it fails
pytest tests/test_new_feature.py -v  # Should fail

# 3. Implement feature
cat > src/new_module.py << 'EOF'
def new_function():
    return "expected"
EOF

# 4. Run test to confirm it passes
pytest tests/test_new_feature.py -v  # Should pass
```

### Feature Development Workflow

**Step-by-step workflow for adding a new feature:**

```bash
# 1. Create feature branch
git checkout -b feature/add-new-feature

# 2. Run tests to establish baseline
npm run test:all

# 3. Write tests for new feature
# - Create test file in appropriate directory
# - Add test cases for expected behavior
# - Add test cases for edge cases and errors

# 4. Implement feature
# - Write code to make tests pass
# - Run tests frequently during development

# 5. Run full test suite
npm run test:all

# 6. Check coverage
./scripts/testing/test-coverage.sh

# 7. Fix any issues
# - Fix failing tests
# - Improve coverage if needed

# 8. Commit changes
git add .
git commit -m "feat: add new feature"

# 9. Push and create PR
git push origin feature/add-new-feature
gh pr create --title "Add new feature" --body "Implements #123"
```

### Bug Fix Workflow

**Workflow for fixing bugs:**

```bash
# 1. Create bug fix branch
git checkout -b fix/bug-description

# 2. Reproduce bug with test
# - Write failing test that reproduces the bug
# - Run test to confirm it fails

# 3. Fix bug
# - Write minimal code to fix the bug
# - Run test to confirm it passes

# 4. Add regression tests
# - Add tests to prevent bug from reoccurring
# - Test edge cases

# 5. Run full test suite
npm run test:all

# 6. Verify fix
# - Manually test the fix
# - Check for side effects

# 7. Commit changes
git add .
git commit -m "fix: describe bug fix"

# 8. Push and create PR
git push origin fix/bug-description
gh pr create --title "Fix bug description" --body "Fixes #456"
```

---

## Pre-Commit Testing

### Quick Pre-Commit Check

**Fast check before committing:**

```bash
# Quick test run (no coverage)
npm run test:all

# Or run tests for specific module
pytest client/tests/
npm test --workspace=api
npm test --workspace=dashboard
```

### Full Pre-Commit Check

**Complete check before committing important changes:**

```bash
# 1. Run all tests
npm run test:all

# 2. Generate coverage report
./scripts/testing/test-coverage.sh

# 3. Check coverage thresholds
# Look for lines like:
# "FAIL Required coverage 70% not met (65%)"

# 4. View coverage details if needed
open coverage-reports/htmlcov-python/index.html
open coverage-reports/coverage-api/index.html

# 5. Fix any issues before committing
```

### Pre-Commit Hook (Optional)

**Set up automatic pre-commit testing:**

```bash
# Install pre-commit hook
npm install -g husky
npx husky install
npx husky add .husky/pre-commit "npm run test:all"

# Now tests run automatically before each commit
git commit -m "my changes"
# Tests will run first, commit only if tests pass
```

### Pre-Commit Checklist

Before committing code, ensure:

- [ ] All tests pass (`npm run test:all`)
- [ ] Coverage meets or exceeds thresholds
- [ ] No test warnings or deprecations
- [ ] New code has tests
- [ ] Bug fixes have regression tests
- [ ] Edge cases are tested
- [ ] Tests are clean (no debug prints, etc.)
- [ ] Test names are descriptive
- [ ] Tests follow project conventions

---

## CI/CD Testing Pipeline

### GitHub Actions Workflow

**Main CI workflow (`.github/workflows/test.yml`):**

```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          pip install -r client/requirements.txt
          npm run install:all

      - name: Run tests
        run: npm run test:all

      - name: Generate coverage
        run: ./scripts/testing/test-coverage.sh

      - name: Upload coverage artifacts
        uses: actions/upload-artifact@v3
        with:
          name: coverage-reports
          path: coverage-reports/
```

### Coverage Workflow

**Coverage reporting workflow (`.github/workflows/coverage.yml`):**

```yaml
name: Coverage

on:
  pull_request:
    branches: [main, develop]

jobs:
  coverage:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Set up environment
        run: |
          pip install -r client/requirements.txt
          npm run install:all

      - name: Run coverage
        run: ./scripts/testing/test-coverage.sh

      - name: Check thresholds
        run: |
          # Check if coverage meets thresholds
          python scripts/check-coverage.py

      - name: Comment PR with coverage
        uses: actions/github-script@v6
        with:
          script: |
            const coverage = require('./coverage-reports/coverage-summary.json');
            const body = `## Coverage Report\n\nLines: ${coverage.lines}%\nFunctions: ${coverage.functions}%`;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });
```

### CI Test Matrix

**Run tests across multiple environments:**

```yaml
test-matrix:
  runs-on: ubuntu-latest
  strategy:
    matrix:
      python-version: ['3.11', '3.12']
      node-version: ['18', '20']

  steps:
    - name: Set up Python ${{ matrix.python-version }}
      uses: actions/setup-python@v4
      with:
        python-version: ${{ matrix.python-version }}

    - name: Set up Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}

    - name: Run tests
      run: npm run test:all
```

### CI Best Practices

1. **Parallel Execution**: Run different test suites in parallel jobs
2. **Caching**: Cache dependencies to speed up builds
3. **Early Failure**: Run quick tests first, fail fast
4. **Artifacts**: Store test reports and coverage as artifacts
5. **Notifications**: Post test results to PRs and Slack

---

## Debugging Failing Tests

### Identify the Failure

```bash
# Run with verbose output
pytest -v

# Run with local variables on failure
pytest -l

# Stop on first failure
pytest -x

# Show detailed error trace
pytest --tb=long

# Run last failed tests
pytest --lf
```

### Debug Python Tests

```bash
# Run specific test
pytest tests/test_specific.py::test_function

# Run with debugger
pytest --pdb

# Run with ipdb debugger
pytest --pdbcls=IPython.terminal.debugger:TerminalPdb --pdb

# Print output during test
pytest -s

# Run with logging
pytest --log-cli-level=DEBUG
```

### Debug TypeScript Tests

```bash
# Run specific test
npm test -- specific.test.ts

# Run with debugger (VS Code)
# Add debugger statement in test
# Run in debug mode

# Run with console output
npm test -- --reporter=verbose

# Run tests in watch mode for faster iteration
npm test -- --watch
```

### Debug Test Failures

**Step-by-step debugging process:**

```bash
# 1. Isolate the failing test
pytest tests/test_failing.py::test_failing_function -v

# 2. Enable debugging
pytest tests/test_failing.py::test_failing_function --pdb

# 3. Inspect state in debugger
# Use 'n' for next, 's' for step into, 'c' for continue
# Inspect variables: p variable_name

# 4. Add debug output
def test_failing_function():
    print(f"Debug: value = {some_value}")
    assert some_value == expected

# 5. Run with print output
pytest tests/test_failing.py -s

# 6. Fix the issue and re-test
```

### Common Issues and Solutions

#### Issue: Test Passes Locally but Fails in CI

**Possible causes:**
- Environment differences
- Race conditions or timing issues
- Test data or state pollution
- Different dependency versions

**Solutions:**
```bash
# 1. Check environment differences
# - Compare Python/Node versions
# - Compare dependency versions
# - Check environment variables

# 2. Check for race conditions
# - Add explicit waits
# - Use proper fixtures for cleanup

# 3. Check for state pollution
# - Run tests in isolation
# - Ensure proper cleanup

# 4. Reproduce CI environment locally
# - Use same container image
# - Use same dependency versions
```

#### Issue: Flaky Tests

**Possible causes:**
- Async operations without proper waiting
- Race conditions
- External dependencies
- Time-dependent code

**Solutions:**
```bash
# 1. Add explicit waits for async operations
await waitFor(() => {
  expect(element).toBeInTheDocument()
})

# 2. Use proper test isolation
@pytest.fixture(autouse=True)
def reset_state():
    # Reset state before each test
    yield
    # Clean up after test

# 3. Mock external dependencies
# Don't rely on external services in tests

# 4. Fix time-dependent code
vi.useFakeTimers()
vi.setSystemTime(new Date('2024-01-01'))
# Run test
vi.useRealTimers()
```

#### Issue: Slow Tests

**Solutions:**
```bash
# 1. Run tests in parallel
pytest -n auto  # Python
vitest --threads  # TypeScript

# 2. Use mocks instead of real dependencies
# Mock external services
# Mock database operations

# 3. Optimize database operations
# Use transactions and rollback
# Use in-memory database for tests

# 4. Skip slow tests during development
@pytest.mark.slow
def test_slow_operation():
    pass

# Skip slow tests
pytest -m "not slow"
```

---

## Performance Testing

### Test Execution Time

**Monitor test execution time:**

```bash
# Run tests with timing
pytest --durations=10

# Show 10 slowest tests
npm test -- --reporter=verbose
```

### Performance Benchmarks

**Add performance tests:**

```python
# tests/test_performance.py
import time

def test_function_performance():
    """Test that function completes within time limit."""
    start_time = time.time()

    result = function_being_tested()

    end_time = time.time()
    execution_time = end_time - start_time

    assert result is not None
    assert execution_time < 1.0, f"Function took {execution_time}s, expected < 1s"
```

```typescript
// tests/performance.test.ts
import { performance } from 'perf_hooks'

it('should complete within time limit', () => {
  const start = performance.now()

  const result = functionBeingTested()

  const end = performance.now()
  const executionTime = end - start

  expect(result).toBeDefined()
  expect(executionTime).toBeLessThan(1000) // < 1 second
})
```

### Load Testing

**Test system under load:**

```bash
# Run tests multiple times to check for memory leaks
for i in {1..100}; do
  npm test
done

# Run tests with multiple workers
pytest -n 4  # 4 parallel workers
vitest --threads --maxThreads=4
```

---

## Test Maintenance

### Regular Test Maintenance Tasks

**Weekly/Monthly tasks:**

```bash
# 1. Update test dependencies
pip install --upgrade pytest pytest-cov
npm update vitest @vitest/coverage-v8

# 2. Review and update test data
# - Remove outdated test data
# - Add new test scenarios
# - Update fixtures

# 3. Review test coverage
./scripts/testing/test-coverage.sh
open coverage-reports/htmlcov-python/index.html

# 4. Remove or update skipped tests
# Search for skipped tests
grep -r "skip\|xfail" tests/

# 5. Update test documentation
# - Update TESTING.md
# - Add new test examples
# - Update test templates
```

### Test Refactoring

**Refactor tests for better maintainability:**

```python
# Before: Duplicated test code
def test_create_agent():
    agent = Agent(name="test", type="assistant")
    assert agent.name == "test"
    assert agent.type == "assistant"

def test_create_agent_with_description():
    agent = Agent(name="test", type="assistant", description="test desc")
    assert agent.name == "test"
    assert agent.type == "assistant"
    assert agent.description == "test desc"

# After: Use parametrized tests
@pytest.mark.parametrize("inputs,expected", [
    ({"name": "test", "type": "assistant"}, {"name": "test", "type": "assistant", "description": None}),
    ({"name": "test", "type": "assistant", "description": "test desc"}, {"name": "test", "type": "assistant", "description": "test desc"}),
])
def test_create_agent(inputs, expected):
    agent = Agent(**inputs)
    for key, value in expected.items():
        assert getattr(agent, key) == value
```

### Test Deletion

**When to delete tests:**

- Feature is removed and tests are no longer relevant
- Tests are duplicated and redundant
- Tests are testing implementation details (not behavior)
- Tests are permanently skipped with no plan to fix

**How to safely delete tests:**

```bash
# 1. Ensure tests are not covering critical functionality
# Check if tests are the only coverage for certain code

# 2. Run full test suite before deletion
npm run test:all

# 3. Delete test
git rm tests/test_to_remove.py

# 4. Run tests again to ensure nothing broke
npm run test:all

# 5. Check coverage still meets thresholds
./scripts/testing/test-coverage.sh
```

---

## Quick Reference

### Development Commands

```bash
# Run all tests
npm run test:all

# Run with coverage
./scripts/testing/test-coverage.sh

# Run specific module
pytest client/tests/
npm test --workspace=api

# Run specific test
pytest tests/test_specific.py::test_function
npm test -- specific.test.ts

# Watch mode
npm test -- --watch

# Debug
pytest --pdb
npm test -- --inspect-brk
```

### CI/CD Commands

```bash
# Trigger CI workflow
gh workflow run test.yml

# Check CI status
gh run list

# View CI logs
gh run view

# Download artifacts
gh run download
```

### Debugging Commands

```bash
# Verbose output
pytest -v
npm test -- --verbose

# Stop on first failure
pytest -x

# Show local variables
pytest -l

# Run last failed
pytest --lf

# Print output
pytest -s
```

---

For more information on:
- **Testing overview**: See [README.md](README.md)
- **Test architecture**: See [TEST_ARCHITECTURE.md](TEST_ARCHITECTURE.md)
- **Writing tests**: See [TEST_WRITING_GUIDE.md](guides/TEST_WRITING_GUIDE.md)
- **Test checklist**: See [TEST_CHECKLIST.md](TEST_CHECKLIST.md)
