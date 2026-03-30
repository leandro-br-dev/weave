# Test Checklist

This document provides comprehensive checklists for testing at different stages of development.

## Table of Contents

1. [Pre-Commit Checklist](#pre-commit-checklist)
2. [Pre-Pull Request Checklist](#pre-pull-request-checklist)
3. [Pre-Release Checklist](#pre-release-checklist)
4. [Test Quality Checklist](#test-quality-checklist)
5. [Coverage Checklist](#coverage-checklist)
6. [CI/CD Checklist](#cicd-checklist)

---

## Pre-Commit Checklist

**Complete this checklist before committing code:**

### Code Changes

- [ ] **Code follows project conventions**
  - [ ] Python code follows PEP 8
  - [ ] TypeScript code follows ESLint rules
  - [ ] File naming follows conventions
  - [ ] Code is properly formatted

- [ ] **Code is documented**
  - [ ] Functions have docstrings (Python)
  - [ ] Complex logic has comments
  - [ ] Public APIs are documented
  - [ ] Types are properly defined (TypeScript)

### Testing Requirements

- [ ] **New code has tests**
  - [ ] Unit tests for new functions/classes
  - [ ] Integration tests for new features
  - [ ] Edge cases are tested
  - [ ] Error cases are tested

- [ ] **Bug fixes have regression tests**
  - [ ] Test reproduces the bug
  - [ ] Test verifies the fix
  - [ ] Test prevents regression

- [ ] **Tests are high quality**
  - [ ] Tests are independent
  - [ ] Tests are deterministic
  - [ ] Test names are descriptive
  - [ ] Tests follow AAA pattern

### Test Execution

- [ ] **All tests pass locally**
  ```bash
  npm run test:all
  ```

- [ ] **No warnings or deprecations**
  - [ ] No pytest warnings
  - [ ] No vitest warnings
  - [ ] No linting warnings

- [ ] **Coverage is maintained or improved**
  ```bash
  ./scripts/coverage-report.sh
  ```
  - [ ] Coverage meets thresholds (70% overall)
  - [ ] No significant coverage decreases
  - [ ] Critical paths are covered

### Code Review Preparation

- [ ] **Commit messages are clear**
  - [ ] Follow conventional commit format
  - [ ] Describe what and why, not how
  - [ ] Reference relevant issues

- [ ] **Changes are ready for review**
  - [ ] Changes are focused and logical
  - [ ] No debug code left in
  - [ ] No commented-out code
  - [ ] No TODOs without issues

### Environment

- [ ] **Environment is clean**
  - [ ] No test artifacts committed
  - [ ] No temporary files committed
  - [ ] `.env.test` is up to date
  - [ ] Dependencies are updated if needed

---

## Pre-Pull Request Checklist

**Complete this checklist before creating a pull request:**

### Testing

- [ ] **All tests pass**
  ```bash
  npm run test:all
  ```

- [ ] **Coverage is adequate**
  ```bash
  ./scripts/coverage-report.sh
  ```
  - [ ] Overall coverage ≥ 70%
  - [ ] New code coverage ≥ 80%
  - [ ] Critical paths covered ≥ 75%

- [ ] **Tests run successfully in CI**
  - [ ] CI workflow passes
  - [ ] No flaky tests
  - [ ] Coverage reports generated

### Documentation

- [ ] **Code is documented**
  - [ ] Public APIs have docstrings
  - [ ] Complex logic has comments
  - [ ] Types are defined (TypeScript)

- [ ] **Tests are documented**
  - [ ] Test files have module docstrings
  - [ ] Complex tests have inline comments
  - [ ] Test fixtures are documented

- [ ] **Documentation is updated**
  - [ ] README.md updated (if needed)
  - [ ] TESTING.md updated (if needed)
  - [ ] API docs updated (if needed)
  - [ ] Changelog updated (if needed)

### Code Quality

- [ ] **Code follows standards**
  - [ ] Linting passes (`npm run lint`)
  - [ ] Type checking passes (`npm run type-check`)
  - [ ] Code is formatted (`npm run format`)
  - [ ] No console.log or debug statements

- [ ] **Code is efficient**
  - [ ] No obvious performance issues
  - [ ] No memory leaks
  - [ ] No unnecessary dependencies
  - [ ] Database queries optimized

- [ ] **Security is considered**
  - [ ] No hardcoded secrets
  - [ ] Input validation added
  - [ ] Output is escaped (XSS prevention)
  - [ ] SQL injection prevented

### Testing Edge Cases

- [ ] **Edge cases tested**
  - [ ] Empty inputs tested
  - [ ] Null/undefined tested
  - [ ] Boundary conditions tested
  - [ ] Invalid inputs tested

- [ ] **Error handling tested**
  - [ ] Error cases tested
  - [ ] Error messages verified
  - [ ] Recovery tested (if applicable)

### Integration Testing

- [ ] **Integration points tested**
  - [ ] API endpoints tested
  - [ ] Database operations tested
  - [ ] External integrations tested (or mocked)

- [ ] **Component interactions tested**
  - [ ] React components integrated
  - [ ] State management tested
  - [ ] Event handling tested

### Performance

- [ ] **Performance is acceptable**
  - [ ] No significant slowdowns
  - [ ] Tests complete in reasonable time
  - [ ] No memory leaks detected

### Pull Request Preparation

- [ ] **PR description is clear**
  - [ ] Describes what changes and why
  - [ ] Lists breaking changes (if any)
  - [ ] Includes screenshots (if UI changes)
  - [ ] References related issues

- [ ] **PR is ready for review**
  - [ ] Changes are focused
  - [ ] Commit history is clean
  - [ ] No merge conflicts
  - [ ] Labels applied

---

## Pre-Release Checklist

**Complete this checklist before releasing:**

### Comprehensive Testing

- [ ] **Full test suite passes**
  ```bash
  npm run test:all
  ```

- [ ] **Coverage meets all thresholds**
  ```bash
  ./scripts/coverage-report.sh
  ```
  - [ ] Lines ≥ 70%
  - [ ] Functions ≥ 70%
  - [ ] Branches ≥ 65%
  - [ ] Statements ≥ 70%

- [ ] **All environments tested**
  - [ ] Development environment
  - [ ] Staging environment
  - [ ] Production-like environment

### Integration Testing

- [ ] **E2E tests pass**
  - [ ] Critical user workflows tested
  - [ ] Cross-component integration tested
  - [ ] Realistic data tested

- [ ] **API compatibility verified**
  - [ ] API contracts maintained
  - [ ] Backward compatibility checked
  - [ ] Documentation matches implementation

### Performance Testing

- [ ] **Performance benchmarks pass**
  - [ ] Response times acceptable
  - [ ] Throughput meets requirements
  - [ ] Resource usage acceptable

- [ ] **Load testing completed**
  - [ ] System tested under load
  - [ ] No memory leaks detected
  - [ ] No race conditions found

### Security Testing

- [ ] **Security review completed**
  - [ ] No known vulnerabilities
  - [ ] Dependencies scanned
  - [ ] Secrets management verified

- [ ] **Security tests pass**
  - [ ] Input validation tested
  - [ ] Authentication tested
  - [ ] Authorization tested

### Documentation

- [ ] **Documentation is complete**
  - [ ] README updated
  - [ ] API documentation updated
  - [ ] CHANGELOG updated
  - [ ] Migration guide (if needed)

- [ ] **Testing documentation updated**
  - [ ] New test patterns documented
  - [ ] Testing guides updated
  - [ ] Examples provided

### Regression Testing

- [ ] **Previous bugs not reoccurring**
  - [ ] Regression tests pass
  - [ ] Previously fixed issues verified

- [ ] **Features not broken**
  - [ ] Smoke tests pass
  - [ ] Critical functionality verified

### Release Preparation

- [ ] **Version number updated**
  - [ ] Package.json updated
  - [ ] Changelog updated
  - [ ] Tag created

- [ ] **Release notes prepared**
  - [ ] New features listed
  - [ ] Breaking changes noted
  - [ ] Migration instructions included

---

## Test Quality Checklist

**Use this checklist to ensure high test quality:**

### Test Structure

- [ ] **Tests follow AAA pattern**
  - [ ] Arrange: Set up test data
  - [ ] Act: Execute code being tested
  - [ ] Assert: Verify expected outcome

- [ ] **Tests are independent**
  - [ ] Tests can run in any order
  - [ ] Tests don't depend on each other
  - [ ] Tests don't share state

- [ ] **Tests are deterministic**
  - [ ] Same inputs always produce same outputs
  - [ ] No random data (or seeded)
  - [ ] No time dependencies (or mocked)

### Test Clarity

- [ ] **Test names are descriptive**
  - [ ] Names describe what is tested
  - [ ] Names follow conventions
  - [ ] Names are not vague

- [ ] **Tests are readable**
  - [ ] Logic is clear
  - [ ] Comments explain complex setup
  - [ ] Assertions are specific

- [ ] **Tests are maintainable**
  - [ ] No code duplication
  - [ ] Fixtures used appropriately
  - [ ] Test data factories used

### Test Coverage

- [ ] **Happy path tested**
  - [ ] Normal operation tested
  - [ ] Expected behavior verified

- [ ] **Edge cases tested**
  - [ ] Empty inputs tested
  - [ ] Null/undefined tested
  - [ ] Boundary conditions tested

- [ ] **Error cases tested**
  - [ ] Invalid inputs tested
  - [ ] Error handling verified
  - [ ] Error messages checked

### Test Data

- [ ] **Test data is isolated**
  - [ ] Not using production data
  - [ ] Test data in test directories
  - [ ] Test data cleaned up

- [ ] **Test data is realistic**
  - [ ] Represents real scenarios
  - [ ] Covers edge cases
  - [ ] Not overly complex

### Mocking

- [ ] **External dependencies mocked**
  - [ ] API calls mocked
  - [ ] Database operations mocked (in integration)
  - [ ] File operations mocked (when appropriate)

- [ ] **Mocks are appropriate**
  - [ ] Not over-mocking
  - [ ] Not mocking code under test
  - [ ] Mock behavior verified

---

## Coverage Checklist

**Use this checklist to ensure adequate coverage:**

### Coverage Metrics

- [ ] **Overall coverage meets threshold**
  - [ ] Lines ≥ 70%
  - [ ] Functions ≥ 70%
  - [ ] Branches ≥ 65%
  - [ ] Statements ≥ 70%

- [ ] **Critical paths covered**
  - [ ] Core business logic ≥ 75%
  - [ ] API routes ≥ 80%
  - [ ] Key components ≥ 75%

### Coverage Gaps

- [ ] **Low-coverage files addressed**
  - [ ] Files < 50% coverage reviewed
  - [ ] Tests added or justification documented

- [ ] **Complex code covered**
  - [ ] Complex functions tested
  - [ ] Complex logic branches tested
  - [ ] Error handling tested

### Coverage Quality

- [ ] **Coverage is meaningful**
  - [ ] Tests verify behavior, not just lines
  - [ ] Not just assertion-less tests
  - [ ] Not testing implementation details

- [ ] **Coverage reports reviewed**
  - [ ] HTML reports reviewed
  - [ ] Uncovered lines examined
  - [ ] Missing tests identified

### Coverage Maintenance

- [ ] **Coverage trends monitored**
  - [ ] Coverage not decreasing
  - [ ] New code has high coverage
  - [ ] Coverage gaps being addressed

---

## CI/CD Checklist

**Use this checklist for CI/CD testing:**

### CI Configuration

- [ ] **CI workflows configured**
  - [ ] Test workflow runs on push/PR
  - [ ] Coverage workflow runs on PR
  - [ ] All test suites included

- [ ] **CI environment configured**
  - [ ] Dependencies installed correctly
  - [ ] Test environment set up
  - [ ] Environment variables configured

### CI Execution

- [ ] **Tests pass in CI**
  - [ ] All test suites pass
  - [ ] No flaky tests
  - [ ] Tests complete in reasonable time

- [ ] **Coverage reports generated**
  - [ ] Coverage artifacts uploaded
  - [ ] Coverage comments posted to PR
  - [ ] Coverage thresholds enforced

### CI Quality

- [ ] **CI is fast**
  - [ ] Tests run in parallel where possible
  - [ ] Dependencies cached
  - [ ] No unnecessary steps

- [ ] **CI is reliable**
  - [ ] Tests don't fail intermittently
  - [ ] Environment issues addressed
  - [ ] Resource issues addressed

### CI Notifications

- [ ] **Notifications configured**
  - [ ] PR status updates
  - [ ] Failure notifications
  - [ ] Coverage reports

---

## Quick Pre-Commit Checklist

**Fast checklist for quick commits:**

```bash
# 1. Run tests
npm run test:all

# 2. Check coverage (if significant changes)
./scripts/coverage-report.sh

# 3. Check linting
npm run lint

# 4. Verify changes
git diff

# 5. Commit
git commit -m "feat: description of changes"
```

### Checklist

- [ ] Tests pass
- [ ] Coverage adequate (if needed)
- [ ] Linting passes
- [ ] Changes reviewed
- [ ] Commit message clear

---

## Troubleshooting Checklist

**Use this checklist when tests fail:**

### Investigation

- [ ] **Identify the failure**
  - [ ] Which test(s) failed?
  - [ ] What is the error message?
  - [ ] Is it a consistent failure?

- [ ] **Isolate the issue**
  - [ ] Run single test: `pytest tests/test_specific.py::test_function`
  - [ ] Run test module: `pytest tests/test_specific.py`
  - [ ] Run test suite: `pytest tests/unit/`

### Diagnosis

- [ ] **Check test code**
  - [ ] Test setup correct?
  - [ ] Assertions correct?
  - [ ] Test data valid?

- [ ] **Check production code**
  - [ ] Code logic correct?
  - [ ] Dependencies correct?
  - [ ] Edge cases handled?

### Resolution

- [ ] **Fix the issue**
  - [ ] Fix test code (if test is wrong)
  - [ ] Fix production code (if code is wrong)
  - [ ] Update test data (if data is wrong)

- [ ] **Verify the fix**
  - [ ] Test passes locally
  - [ ] Related tests still pass
  - [ ] Coverage maintained

---

For more information on:
- **Testing overview**: See [README.md](README.md)
- **Test architecture**: See [TEST_ARCHITECTURE.md](TEST_ARCHITECTURE.md)
- **Test workflows**: See [TEST_WORKFLOWS.md](TEST_WORKFLOWS.md)
- **Writing tests**: See [TEST_WRITING_GUIDE.md](guides/TEST_WRITING_GUIDE.md)
