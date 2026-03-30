# Client Tests

Test suite for the weave client library.

## Directory Structure

```
client/tests/
├── unit/          # Unit tests for client utilities and functions
└── integration/   # Integration tests for client API interactions
```

## Running Tests

### Run All Client Tests
```bash
# From the client directory
pytest

# From the root
pytest client/tests/
```

### Run Specific Test Suites
```bash
# Unit tests
pytest client/tests/unit/

# Integration tests
pytest client/tests/integration/
```

### Run with Coverage
```bash
pytest client/tests/ --cov=client --cov-report=html
```

## Test Organization

- **Unit tests**: Test individual client functions and utilities in isolation
- **Integration tests**: Test client interactions with the API

## Setup

Tests require:
- API server running (for integration tests)
- Environment variables set (see `.env.test`)
- Test configuration loaded

## Configuration

Test configuration is in `pytest.ini` and `.env.test`.

## Naming Conventions

- Test files: `test_<module>.py`
- Test classes: `Test<ClassName>`
- Test functions: `test_<scenario>_<outcome>`
