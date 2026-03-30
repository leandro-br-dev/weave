# End-to-End Tests

This directory contains comprehensive end-to-end tests that verify the complete workflow of the Agents Manager system.

## Overview

End-to-end (E2E) tests validate the entire system from frontend to backend, ensuring all components work together correctly. These tests typically involve:

- Complete user workflows
- Multiple system components
- Real API calls and database operations
- Frontend-backend integration

## Prerequisites

Before running E2E tests, ensure:

1. **Services Running:**
   ```bash
   # Start API server
   cd api && npm run dev

   # Start Dashboard
   cd dashboard && npm run dev

   # Start Daemon (if required)
   cd client && python main.py
   ```

2. **Database Setup:**
   ```bash
   # Ensure test database is available
   make test-setup
   ```

3. **Environment Configuration:**
   - Verify `.env` files are configured correctly
   - Check API tokens and authentication
   - Ensure all required ports are available

## Running E2E Tests

### Run All E2E Tests

```bash
# Run all E2E tests
make test-e2e

# Or run directly
./tests/scripts/e2e/test-*.sh
```

### Run Specific E2E Test

```bash
# Example: Run improvement workflow E2E test
./tests/scripts/e2e/test-improvement-end-to-end.sh
```

### Running with Verbosity

```bash
# Enable verbose output
VERBOSE=1 ./tests/scripts/e2e/test-improvement-end-to-end.sh

# Save output to log file
./tests/scripts/e2e/test-improvement-end-to-end.sh 2>&1 | tee e2e-test.log
```

## Available E2E Tests

### `test-improvement-end-to-end.sh`

**Purpose:** Tests the complete "Improve with AI" workflow from frontend trigger to backend completion.

**What it tests:**
- ✅ Backend API endpoints
- ✅ Workspace and agent creation
- ✅ Improvement plan creation and execution
- ✅ Structured output submission and retrieval
- ✅ Frontend polling compatibility
- ✅ Edge cases (empty content, long content, invalid IDs)

**Duration:** ~2-3 minutes

**Requirements:**
- API server running on `http://localhost:3000`
- Valid API token configured
- Test workspace available

**Expected Output:**
```
========================================
TEST SUMMARY
========================================

Total Tests: 15
Passed: 15
Failed: 0

✓ ALL AUTOMATED TESTS PASSED
```

## Test Coverage

### Backend Tests
- API server availability
- Workspace management
- Plan creation and status tracking
- Structured output handling
- Error responses

### Frontend Tests
- Polling mechanism
- Modal display
- Content update workflow
- Error handling UI

### Integration Tests
- Frontend-backend communication
- State synchronization
- Race condition prevention
- Data consistency

## Troubleshooting

### Common Issues

**1. API Server Not Running**
```
ERROR: API is not accessible
Solution: Start API server with `cd api && npm run dev`
```

**2. Authentication Failures**
```
ERROR: No API token found in .env
Solution: Check api/.env file contains API_BEARER_TOKEN
```

**3. Database Connection Issues**
```
ERROR: Cannot connect to database
Solution: Ensure database is running with `make db-up`
```

**4. Port Already in Use**
```
ERROR: Port 3000 already in use
Solution: Kill existing process or change port configuration
```

### Debug Mode

Enable debug mode for more detailed output:

```bash
# Set debug environment variable
export DEBUG=1
export VERBOSE=1

# Run test with debugging
./tests/scripts/e2e/test-improvement-end-to-end.sh
```

### Clean Test Artifacts

Remove test data and temporary files:

```bash
# Clean test workspaces and agents
make test-clean

# Or manually clean test data
rm -f /tmp/improvement-test-*.log
rm -f /tmp/test_plan_id.txt
```

## Expected Test Results

### Success Criteria

All E2E tests should pass with:
- ✅ All services reachable
- ✅ All API calls return 200/201 status codes
- ✅ Data consistency maintained throughout
- ✅ No race conditions or timing issues
- ✅ Proper error handling for edge cases

### Performance Expectations

- Individual test steps: < 5 seconds each
- Complete E2E test suite: < 5 minutes
- API response times: < 500ms
- Frontend polling: 2-second intervals

## Continuous Integration

### CI/CD Integration

E2E tests run automatically in CI/CD pipelines:

```yaml
# Example CI configuration
test:
  script:
    - make test-setup
    - make test-e2e
    - make test-teardown
  only:
    - merge_requests
    - main
```

### Test Reports

Test results are saved to:
- Console output (real-time)
- Log files: `/tmp/e2e-test-*.log`
- CI artifacts (if applicable)

## Adding New E2E Tests

When adding new E2E tests:

1. **Create test script:** `tests/scripts/e2e/test-your-feature.sh`
2. **Make executable:** `chmod +x tests/scripts/e2e/test-your-feature.sh`
3. **Add header comment:** Document purpose and requirements
4. **Update this README:** Add test description to "Available E2E Tests" section
5. **Test locally:** Verify test passes before committing
6. **Update Makefile:** Add target if needed

### E2E Test Template

```bash
#!/bin/bash

###############################################################################
# E2E Test: [Your Test Name]
# Description: [What this test validates]
###############################################################################

set -e

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
TOKEN="${API_BEARER_TOKEN:-test-token}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Test functions
test_prerequisites() {
    log_info "Checking prerequisites..."
    # Add prerequisite checks
}

test_main_workflow() {
    log_info "Testing main workflow..."
    # Add test logic
}

# Main execution
main() {
    log_info "Starting E2E test..."
    test_prerequisites
    test_main_workflow
    log_info "Test completed successfully!"
}

main
```

## Maintenance

### Regular Maintenance Tasks

- **Weekly:** Review test logs for failures
- **Monthly:** Update test data and expectations
- **Quarterly:** Review and optimize test performance
- **As needed:** Update tests for new features

### Test Health Monitoring

Monitor test health metrics:
- Pass/fail rates
- Execution time trends
- Flaky test identification
- Resource utilization

## Support

For issues or questions about E2E tests:

1. Check this README first
2. Review test logs in `/tmp/`
3. Check main documentation: `docs/testing/`
4. Contact: [Maintainer Name/Team]

## Resources

- [Main Testing Documentation](../README.md)
- [Workflow Tests](../workflow/README.md)
- [Manual Tests](../manual/README.md)
- [Test Organization Guide](../../../docs/testing/scripts-organization.md)
