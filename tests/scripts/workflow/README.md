# Workflow Test Scripts

This directory contains automated test scripts that validate complete workflows and end-to-end scenarios.

## Purpose

Workflow tests are automated integration tests that verify:
- Complete user workflows from start to finish
- Multi-step processes that span multiple components
- Integration between different system modules
- Real-world usage scenarios

## Available Tests

### Improvement Workflow Tests

#### `test-improvement-fix.sh`
Comprehensive test of the improvement workflow with edge cases and error handling.

**Coverage:**
- Standard improvement workflow
- Empty content handling
- Long content handling
- Invalid plan ID handling
- API error recovery
- UI state management

**Usage:**
```bash
./tests/scripts/workflow/test-improvement-fix.sh
```

**Prerequisites:**
- Application running on `http://localhost:3000`
- Test fixtures loaded
- API endpoints accessible

**Test Duration:** ~2-3 minutes

#### `test-structured-output-fix.sh`
Tests the structured output generation with race condition fixes.

**Coverage:**
- Structured output generation
- Concurrent request handling
- Race condition prevention
- Output validation

**Usage:**
```bash
./tests/scripts/workflow/test-structured-output-fix.sh
```

**Prerequisites:**
- Application running
- Structured output endpoints configured
- Test data available

**Test Duration:** ~1-2 minutes

## Running Workflow Tests

### Run All Workflow Tests

```bash
# Run all workflow tests
make test-workflows

# Or manually
for test in tests/scripts/workflow/*.sh; do
  echo "Running $test..."
  "$test" || echo "FAILED: $test"
done
```

### Run Individual Tests

```bash
# Specific test
./tests/scripts/workflow/test-improvement-fix.sh

# With verbose output
VERBOSE=true ./tests/scripts/workflow/test-improvement-fix.sh

# With specific environment
NODE_ENV=test ./tests/scripts/workflow/test-improvement-fix.sh
```

### Continuous Integration

Workflow tests are run automatically in CI/CD pipelines:

```yaml
# Example CI configuration
- name: Run workflow tests
  run: |
    npm run test:workflows
```

## Test Structure

### Standard Test Script Format

All workflow test scripts follow this structure:

```bash
#!/bin/bash
# Test: [Test Name]
# Description: [What this test validates]
# Author: [Author name]
# Last Updated: [Date]

set -e  # Exit on error

# Configuration
APP_URL="${APP_URL:-http://localhost:3000}"
TEST_TIMEOUT="${TEST_TIMEOUT:-120}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# Setup
setup() {
  log_info "Setting up test environment..."
  # Setup commands
}

# Test execution
run_tests() {
  log_info "Running tests..."
  # Test commands
}

# Cleanup
cleanup() {
  log_info "Cleaning up..."
  # Cleanup commands
}

# Main execution
trap cleanup EXIT
setup
run_tests
log_info "All tests passed!"
```

## Test Coverage

### Current Coverage Matrix

| Workflow | Test Script | Coverage | Status |
|----------|-------------|----------|--------|
| Improvement | test-improvement-fix.sh | 95% | ✅ Active |
| Structured Output | test-structured-output-fix.sh | 90% | ✅ Active |
| Plan Extraction | TBD | 0% | 🔄 Planned |
| Content Generation | TBD | 0% | 🔄 Planned |

## Creating New Workflow Tests

### Step 1: Plan the Test

1. **Define the workflow:**
   - What is the start point?
   - What are the intermediate steps?
   - What is the expected end state?

2. **Identify test scenarios:**
   - Happy path (normal operation)
   - Edge cases (boundary conditions)
   - Error cases (failure modes)

3. **Determine prerequisites:**
   - Application state requirements
   - Test data needs
   - External dependencies

### Step 2: Create the Test Script

Use the standard template:

```bash
#!/bin/bash
set -e

# Test metadata
TEST_NAME="test-new-workflow"
TEST_VERSION="1.0.0"

# Configuration variables
# ...

# Test functions
test_happy_path() {
  # Test normal workflow
}

test_edge_cases() {
  # Test boundary conditions
}

test_error_cases() {
  # Test error handling
}

# Run all tests
main() {
  test_happy_path
  test_edge_cases
  test_error_cases
}

main
```

### Step 3: Implement Test Logic

1. **Use helper functions for common operations:**
   ```bash
   # API call helper
   api_call() {
     curl -s -X POST "$APP_URL/api/endpoint" \
       -H "Content-Type: application/json" \
       -d "$1"
   }

   # Assertion helper
   assert_equals() {
     if [ "$1" != "$2" ]; then
       log_error "Assertion failed: $1 != $2"
       exit 1
     fi
   }
   ```

2. **Add proper error handling:**
   ```bash
   # Validate response
   if ! echo "$response" | jq -e '.success' > /dev/null; then
     log_error "API call failed"
     exit 1
   fi
   ```

3. **Include cleanup logic:**
   ```bash
   cleanup() {
     log_info "Cleaning up test data..."
     # Cleanup commands
   }
   trap cleanup EXIT
   ```

### Step 4: Document the Test

1. **Add comments explaining each test section**
2. **Document prerequisites and setup**
3. **Include expected results**
4. **Add troubleshooting section**

### Step 5: Test and Validate

1. **Run the test locally:**
   ```bash
   ./tests/scripts/workflow/your-new-test.sh
   ```

2. **Verify it passes:**
   - All assertions succeed
   - No false positives
   - Proper cleanup occurs

3. **Test failure scenarios:**
   - What happens when the app is down?
   - What happens with invalid data?
   - What happens when services are slow?

### Step 6: Integrate with CI

Add to CI configuration:

```yaml
workflow-tests:
  script:
    - npm run test:workflows
  artifacts:
    reports:
      junit: test-results/workflow-*.xml
```

## Best Practices

### Test Design

- **Test one thing well:** Each test should validate a specific workflow
- **Be idempotent:** Tests should be repeatable without side effects
- **Be fast:** Optimize for quick execution
- **Be reliable:** Avoid flaky tests with proper waits and checks

### Test Data

- **Use fixtures:** Load test data from files, don't hardcode
- **Clean up:** Remove test data after tests complete
- **Isolate:** Don't share state between tests

### Error Handling

- **Fail fast:** Exit on first error to identify issues quickly
- **Clear messages:** Provide helpful error messages
- **Proper cleanup:** Always clean up resources, even on failure

### Maintenance

- **Update when code changes:** Keep tests synchronized with code
- **Remove obsolete tests:** Archive tests for removed features
- **Refactor:** Improve test code quality over time

## Monitoring and Reporting

### Test Results

Test results are stored in:

```bash
# Test output
test-results/workflow-*.log

# JUnit reports
test-results/workflow-*.xml

# Coverage reports
coverage/workflow-coverage.json
```

### Performance Metrics

Track test execution time:

```bash
# Log test duration
time ./tests/scripts/workflow/test-improvement-fix.sh
```

### Failure Analysis

When tests fail:

1. **Check logs:** Review test output for specific errors
2. **Check application logs:** Look for related application errors
3. **Check environment:** Verify all dependencies are available
4. **Reproduce locally:** Run the test manually to observe behavior

## Troubleshooting

### Common Issues

**Tests timeout:**
- Increase `TEST_TIMEOUT` environment variable
- Check application performance
- Verify network connectivity

**Tests fail intermittently:**
- Add proper waits between operations
- Implement retry logic for transient failures
- Check for race conditions

**Tests fail locally but pass in CI:**
- Check environment differences
- Verify local configuration
- Compare dependency versions

**Tests pass locally but fail in CI:**
- Check CI environment configuration
- Verify all dependencies are installed in CI
- Check for timing issues (CI may be slower)

## Related Documentation

- [Testing Overview](../../README.md)
- [Test Organization](../../docs/testing/test-organization.md)
- [Manual Testing Guide](../manual/README.md)
- [Integration Testing](../../docs/testing/integration-tests.md)
