# Client Unit Tests

Unit tests for client utilities, helpers, and business logic.

## Purpose

Unit tests verify that individual client functions and utilities work correctly in isolation.

## Test Structure

```python
# test_utils.py
import pytest
from client.utils import format_agent_name, validate_config

class TestFormatAgentName:
    def test_format_name_with_valid_input(self):
        result = format_agent_name("test-agent")
        assert result == "Test Agent"

    def test_format_name_with_empty_string(self):
        with pytest.raises(ValueError):
            format_agent_name("")

class TestValidateConfig:
    def test_validate_config_with_all_fields(self):
        config = {"model": "claude-3-5-sonnet", "temperature": 0.7}
        assert validate_config(config) is True

    def test_validate_config_with_missing_model(self):
        config = {"temperature": 0.7}
        assert validate_config(config) is False
```

## Running Tests

```bash
# Run all unit tests
pytest client/tests/unit/

# Run specific file
pytest client/tests/unit/test_utils.py

# Run specific test
pytest client/tests/unit/test_utils.py::TestFormatAgentName

# Run with coverage
pytest client/tests/unit/ --cov=client.utils --cov-report=html
```

## Guidelines

1. **Test pure functions**: Focus on functions without side effects
2. **Mock dependencies**: Use mocks for external dependencies
3. **Test edge cases**: Include boundary conditions and error cases
4. **Keep tests fast**: Unit tests should run in milliseconds
5. **Use descriptive names**: Test names should describe what they test

## Common Patterns

### Testing Utility Functions
```python
def test_string_utility():
    result = format_string("test")
    assert result == "Test"
```

### Testing Validation
```python
def test_validation_success():
    assert validate_email("test@example.com") is True

def test_validation_failure():
    assert validate_email("invalid") is False
```

### Testing Data Transformation
```python
def test_data_transformation():
    data = {"name": "test"}
    result = transform_agent(data)
    assert result["displayName"] == "Test"
```

### Testing Error Handling
```python
def test_error_handling():
    with pytest.raises(ValueError):
        risky_operation()
```
