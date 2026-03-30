# Unit Tests

Unit tests for shared utilities, libraries, and cross-cutting concerns.

## Purpose

Unit tests verify that individual functions, classes, and modules work correctly in isolation. These tests should:

- Test a single piece of functionality
- Have no external dependencies (use mocks)
- Run very fast
- Be deterministic

## Naming Conventions

- Files: `test_<module_name>.py`
- Classes: `Test<ClassName>`
- Functions: `test_<function_name>_<scenario>`

## Example Structure

```python
# test_utils.py
import pytest
from utils import format_date

class TestFormatDate:
    def test_format_date_with_valid_input(self):
        result = format_date("2024-01-01")
        assert result == "January 1, 2024"

    def test_format_date_with_invalid_input(self):
        with pytest.raises(ValueError):
            format_date("invalid")
```

## Running Tests

```bash
# Run all unit tests
pytest tests/unit/

# Run specific test file
pytest tests/unit/test_utils.py

# Run with coverage
pytest tests/unit/ --cov=utils --cov-report=html
```

## Guidelines

1. **Keep tests focused**: Each test should verify one thing
2. **Use descriptive names**: Test names should describe what they test
3. **Arrange-Act-Assert**: Structure tests clearly
4. **Mock external dependencies**: Don't depend on databases, APIs, etc.
5. **Test edge cases**: Include boundary conditions and error cases
