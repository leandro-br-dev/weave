# Test Scripts Organization

This directory contains all test scripts used for testing the weave application.

## Directory Structure

```
tests/scripts/
├── manual/          # Manual test scripts that require human interaction
├── workflow/        # Automated workflow and integration test scripts
└── legacy/          # Archived test scripts kept for historical reference
```

## Categories

### Manual Tests (`manual/`)
Test scripts that require manual execution and human observation. These typically test:
- UI interactions and visual components
- Modal dialogs and user workflows
- Edge cases that are difficult to automate
- Exploratory testing scenarios

**Usage:** See `manual/README.md` for instructions on running manual tests.

### Workflow Tests (`workflow/`)
Automated test scripts that test complete workflows and end-to-end scenarios. These include:
- Improvement workflow testing
- Integration workflow validation
- Multi-step process testing

**Usage:** See `workflow/README.md` for available workflow tests.

### Legacy Tests (`legacy/`)
Archived test scripts that have been superseded by newer tests or are no longer maintained. These are kept for:
- Historical reference
- Understanding previous testing approaches
- Potential reuse of test scenarios

**Note:** Tests in this directory should not be used for active testing.

## Running Tests

### Manual Tests
```bash
# Run a specific manual test script
./tests/scripts/manual/test-name.sh
```

### Workflow Tests
```bash
# Run a specific workflow test
./tests/scripts/workflow/test-name.sh

# Run all workflow tests
make test-workflows
```

## Test Script Guidelines

When creating new test scripts:

1. **Determine the category:**
   - Requires human interaction? → `manual/`
   - Fully automated workflow? → `workflow/`
   - Superseded by new test? → `legacy/`

2. **Follow naming conventions:**
   - Shell scripts: `test-feature-name.sh`
   - Python scripts: `test_feature_name.py`
   - Descriptive names that explain what is being tested

3. **Include documentation:**
   - Add comments explaining test purpose
   - Document any prerequisites or setup requirements
   - Include expected results

4. **Make scripts executable:**
   ```bash
   chmod +x tests/scripts/**/*.sh
   ```

## Maintenance

- Review and update test scripts regularly
- Move obsolete tests to `legacy/`
- Keep documentation current with test changes
- Remove tests from `legacy/` after 6 months if no longer referenced

## Related Documentation

- [Testing Overview](../../README.md)
- [Test Organization](../../docs/testing/test-organization.md)
- [Consolidation Plan](../../docs/testing/consolidation-plan.md)
