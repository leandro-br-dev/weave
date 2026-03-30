# Manual Test Scripts

This directory contains test scripts that require manual execution and human observation.

## Purpose

Manual tests are used for scenarios that are difficult to automate or require human judgment, such as:
- Visual validation of UI components
- User experience workflows
- Modal dialogs and interactive elements
- Complex multi-step scenarios
- Exploratory testing

## Available Tests

### Improvement Workflow Manual Tests

#### `test-improvement-manual.sh`
Tests the improvement workflow with manual validation steps.

**Prerequisites:**
- Application running on `http://localhost:3000`
- Test content loaded in the application
- Browser developer tools open for inspection

**Test Steps:**
1. Navigate to the improvement feature
2. Select content for improvement
3. Observe the modal appearance and layout
4. Verify improvement suggestions display correctly
5. Validate the acceptance/rejection workflow
6. Confirm content is updated properly

**Expected Results:**
- Modal appears smoothly without flickering
- All UI elements are properly aligned
- Improvement suggestions are relevant and displayed correctly
- Content updates reflect accepted changes

#### `test-improvement-modal.html`
Interactive HTML test page for improvement modal UI validation.

**Usage:**
```bash
# Open in browser
open tests/scripts/manual/test-improvement-modal.html
# or
firefox tests/scripts/manual/test-improvement-modal.html
```

**Test Coverage:**
- Modal positioning and z-index
- Button states and interactions
- Loading states and animations
- Responsive design at different screen sizes

## Running Manual Tests

### Preparation

1. **Start the application:**
   ```bash
   npm run dev
   # or
   python -m server.main
   ```

2. **Prepare test data:**
   ```bash
   # Load test fixtures if needed
   npm run load-fixtures
   ```

3. **Open required tools:**
   - Browser (Chrome/Firefox)
   - Developer tools (F12)
   - Network tab for API monitoring
   - Console for JavaScript errors

### Execution

For each test script:

1. **Read the test script first** to understand what will be tested
2. **Follow the documented steps** in the test script
3. **Record results** in a test run log:
   ```bash
   # Create a test run log
   echo "Test Run: $(date)" > manual-test-log.md
   echo "Status: PASS | FAIL" >> manual-test-log.md
   ```
4. **Document any issues** found during testing

### Test Reporting

After completing manual tests, create a report including:

- **Test Date:** When tests were run
- **Tester Name:** Who performed the tests
- **Environment:** OS, browser, application version
- **Results:** Pass/Fail for each test
- **Issues:** Any bugs or problems discovered
- **Screenshots:** Visual evidence of issues (if applicable)

## Best Practices

### Before Testing
- Review test requirements and acceptance criteria
- Ensure test environment is properly configured
- Have all necessary tools and accounts ready

### During Testing
- Follow test steps exactly as documented
- Take notes on any unexpected behavior
- Capture screenshots of UI issues
- Record console errors or warnings

### After Testing
- Document all findings thoroughly
- Report bugs with clear reproduction steps
- Update test scripts if improvements are identified
- Share results with the development team

## Creating New Manual Tests

When creating a new manual test script:

1. **Use the template:**
   ```bash
   #!/bin/bash
   # Test: [Test Name]
   # Purpose: [What this test validates]
   # Prerequisites: [What needs to be set up]
   # Expected Results: [What should happen]
   # Last Updated: [Date]

   echo "Starting manual test: [Test Name]"
   echo "Please follow these steps:"
   # ... test steps ...
   ```

2. **Include clear instructions:**
   - Number each step
   - Provide specific commands or actions
   - Describe what to observe at each step

3. **Document expected results:**
   - What success looks like
   - Common failure modes
   - What to do if test fails

4. **Make it executable:**
   ```bash
   chmod +x tests/scripts/manual/your-test.sh
   ```

## Automation Candidates

Periodically review manual tests to identify candidates for automation:

**Good automation candidates:**
- Tests with clear pass/fail criteria
- Repetitive tests run frequently
- Tests that don't require visual validation
- Tests with predictable outcomes

**Poor automation candidates:**
- Tests requiring subjective judgment
- Visual design validation
- Complex UI workflows that change frequently
- Tests that are expensive to automate

## Troubleshooting

### Common Issues

**Application won't start:**
- Check port availability (`lsof -i :3000`)
- Verify dependencies are installed
- Check application logs

**Test data not loading:**
- Verify fixture files exist
- Check database connection
- Review API endpoints

**Unexpected behavior:**
- Clear browser cache and cookies
- Check for JavaScript errors in console
- Verify application version

## Related Documentation

- [Testing Overview](../../README.md)
- [Test Organization](../../docs/testing/test-organization.md)
- [Automated Testing Guide](../workflow/README.md)
