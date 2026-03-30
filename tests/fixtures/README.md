# Test Fixtures

Shared test data, factories, and fixtures for use across all test suites.

## Directory Structure

```
fixtures/
├── html/           # HTML fixtures for manual testing utilities
├── data/           # Test data files (JSON, TXT, CSV, etc.)
└── README.md       # This file
```

## Purpose

Fixtures provide reusable test data and setup/teardown logic to keep tests DRY (Don't Repeat Yourself).

## Fixture Types

### Database Fixtures
```python
# conftest.py
@pytest.fixture
def db_session():
    """Create a test database session."""
    session = Session(bind=engine)
    yield session
    session.rollback()
    session.close()
```

### Model Factories
```python
# factories.py
@pytest.fixture
def sample_agent():
    """Create a sample agent for testing."""
    return Agent(
        name="test-agent",
        type="assistant",
        status="active"
    )
```

### Test Data
```python
# test_data.py
@pytest.fixture
def sample_config():
    """Load sample configuration for testing."""
    return {
        "model": "claude-3-5-sonnet",
        "temperature": 0.7,
        "max_tokens": 4096
    }
```

## Naming Conventions

- Fixture files: `<module>_fixtures.py` or `factories.py`
- Fixture functions: Descriptive names like `sample_agent`, `test_db`, `mock_client`

## Using Fixtures

```python
# tests/unit/test_agent.py
def test_agent_creation(sample_agent):
    """Test agent creation with sample data."""
    agent = Agent.create(sample_agent)
    assert agent.name == "test-agent"
```

## HTML Fixtures (`html/`)

Interactive HTML-based testing utilities for manual testing and development.

### Available Fixtures

- **`test-improvement-modal.html`** - Interactive testing helper for the AI improvement modal localStorage persistence feature
  - Allows manual testing of localStorage states
  - Provides buttons to simulate different improvement scenarios
  - Includes pre-configured test scenarios
  - Useful for verifying localStorage behavior without running the full application

### Usage

```bash
# Open the HTML fixture in a browser
open tests/fixtures/html/test-improvement-modal.html

# Or with a local server
python -m http.server 8000
# Then navigate to: http://localhost:8000/tests/fixtures/html/test-improvement-modal.html
```

## Test Data (`data/`)

Placeholder for test data files that may include:

- Sample JSON responses
- Mock configuration files
- Test input data
- Expected output data

## Guidelines

1. **Keep fixtures simple**: Don't add complex logic
2. **Make fixtures reusable**: Use them in multiple tests
3. **Use pytest fixtures**: Leverage pytest's fixture system
4. **Clean up properly**: Ensure fixtures clean up after themselves
5. **Document fixtures**: Add docstrings explaining what each fixture provides

### Adding New Fixtures

1. **HTML Fixtures**: Place in `html/` directory
   - Must be self-contained (no external dependencies if possible)
   - Include clear usage instructions
   - Document the purpose and testing scenarios

2. **Data Files**: Place in `data/` directory
   - Use descriptive names
   - Include comments or metadata if needed
   - Keep files small and focused

## Related Documentation

- [Test Organization](../../docs/testing/test-organization.md)
- [Testing Guide](../../docs/testing/testing-guide.md)
- [Test Migration Log](../../docs/testing/test-migration-log.md)
