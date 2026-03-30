# Test Artifacts

This directory contains output files, logs, and other artifacts generated during test execution.

## Purpose

Test artifacts are files created during test runs that provide:
- **Debugging information**: Logs, screenshots, error dumps
- **Test outputs**: Generated files, transformation results
- **Performance data**: Benchmark results, timing data
- **Coverage reports**: Code coverage reports and metrics

## Directory Structure

```
artifacts/
├── logs/           # Test execution logs
├── screenshots/    # Browser screenshots from E2E tests
├── coverage/       # Code coverage reports
├── outputs/        # Generated test output files
└── .gitkeep        # Ensures directory is tracked in git
```

## Types of Artifacts

### Logs (`logs/`)
- Test execution logs
- Console output captures
- Server logs during tests
- Error stack traces

### Screenshots (`screenshots/`)
- Browser screenshots from E2E tests
- Visual regression test images
- Failure screenshots for debugging

### Coverage (`coverage/`)
- HTML coverage reports
- JSON coverage data
- LCOV reports
- Coverage badge images

### Outputs (`outputs/`)
- Generated files from tests
- Transformation results
- Export data
- Temporary test files

## Guidelines

### Git Management

**⚠️ IMPORTANT**: This directory should typically be `.gitignore`'d to avoid committing:
- Large binary files (screenshots, PDFs)
- Auto-generated logs
- Coverage reports
- Temporary test outputs

**Exceptions**: Commit only:
- Sample artifacts for documentation
- Expected output examples
- Small reference files

### Artifact Lifecycle

1. **Creation**: Generated during test execution
2. **Retention**: Keep for debugging/failure analysis
3. **Cleanup**: Remove old artifacts periodically
4. **Archival**: Archive important artifacts separately

## Usage

### During Test Development

```bash
# Run tests with artifact generation
pytest tests/ --artifacts-dir=tests/artifacts/

# Generate coverage report
npm test -- --coverage

# E2E tests with screenshots
cypress run --screenshots-folder=tests/artifacts/screenshots/
```

### After Test Failures

```bash
# View recent test logs
ls -lt tests/artifacts/logs/ | head -20

# Check failure screenshots
ls tests/artifacts/screenshots/failures/

# Review coverage report
open tests/artifacts/coverage/index.html
```

### Cleanup

```bash
# Remove all artifacts
rm -rf tests/artifacts/*

# Remove only logs
rm -rf tests/artifacts/logs/*

# Remove artifacts older than 7 days
find tests/artifacts/ -type f -mtime +7 -delete
```

## Configuration

### Git Ignore Pattern

Add to `.gitignore`:
```
# Test artifacts
tests/artifacts/logs/
tests/artifacts/screenshots/
tests/artifacts/coverage/
tests/artifacts/outputs/*.tmp
tests/artifacts/outputs/*.temp
```

### CI/CD Integration

```yaml
# Example: GitHub Actions
- name: Run tests
  run: pytest --artifacts-dir=tests/artifacts/

- name: Upload artifacts on failure
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: test-artifacts
    path: tests/artifacts/
```

## Best Practices

1. **Organize by type**: Keep different artifact types in separate directories
2. **Use timestamps**: Include timestamps in filenames for easy identification
3. **Compress large files**: Compress screenshots and logs to save space
4. **Clean regularly**: Implement automated cleanup for old artifacts
5. **Document format**: Include README files explaining artifact formats

## Artifact Naming Conventions

```
logs/
  ├── test-{name}-{timestamp}.log
  ├── error-{test-name}-{timestamp}.txt

screenshots/
  ├── {test-name}-{step}-{timestamp}.png
  ├── failure-{test-name}-{timestamp}.png

coverage/
  ├── coverage-{timestamp}.html
  ├── coverage-{timestamp}.json

outputs/
  ├── {test-name}-output-{timestamp}.txt
  ├── {test-name}-result-{timestamp}.json
```

## Related Documentation

- [Testing Guide](../../docs/testing/testing-guide.md)
- [Test Organization](../../docs/testing/test-organization.md)
- [CI/CD Configuration](../../docs/ci-cd/configuration.md)
