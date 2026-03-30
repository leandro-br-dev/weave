# Test Writing Guide

This comprehensive guide covers best practices for writing tests in the weave project. Use this as a reference when creating new tests or improving existing ones.

## Table of Contents

1. [General Testing Principles](#general-testing-principles)
2. [Python Test Writing Guidelines](#python-test-writing-guidelines)
3. [TypeScript Test Writing Guidelines](#typescript-test-writing-guidelines)
4. [Integration Test Guidelines](#integration-test-guidelines)
5. [Naming Conventions](#naming-conventions)
6. [Setup/Teardown Patterns](#setupteardown-patterns)
7. [Assertion Best Practices](#assertion-best-practices)
8. [Mock/Stub Usage Guidelines](#mockstub-usage-guidelines)
9. [Test Data Management](#test-data-management)
10. [Error Handling in Tests](#error-handling-in-tests)
11. [Test Organization](#test-organization)
12. [Common Patterns](#common-patterns)

---

## General Testing Principles

### The Testing Pyramid

```
        /\
       /  \      E2E Tests (few)
      /    \
     /------\    Integration Tests (some)
    /        \
   /----------\  Unit Tests (many)
  /____________\
```

- **Unit Tests**: Test individual functions/classes in isolation
- **Integration Tests**: Test interactions between components
- **E2E Tests**: Test complete user workflows

### Key Principles

1. **Test Behavior, Not Implementation**
   - Focus on what the code does, not how it does it
   - Tests should remain valid even if implementation changes

2. **Keep Tests Independent**
   - Each test should work in isolation
   - Tests shouldn't depend on other tests
   - Tests should be repeatable and deterministic

3. **Follow the AAA Pattern**
   - **Arrange**: Set up the test data and preconditions
   - **Act**: Execute the code being tested
   - **Assert**: Verify the expected outcome

4. **Test One Thing Per Test**
   - Each test should verify one behavior
   - Use parameterized tests for multiple scenarios

5. **Make Tests Readable**
   - Use descriptive test names
   - Add comments for complex test logic
   - Structure tests clearly

---

## Python Test Writing Guidelines

### File Structure

```python
#!/usr/bin/env python3
"""
Module test file with clear documentation.

Tests for the AgentService module.
"""

import pytest
from unittest.mock import Mock, patch
from module import ClassBeingTested


class TestClassName:
    """Test suite for ClassName."""

    def test_method_with_valid_input(self):
        """Test description that explains what is being tested."""
        # Arrange
        input_data = 'test'

        # Act
        result = function_being_tested(input_data)

        # Assert
        assert result == 'expected'
```

### Fixtures

```python
@pytest.fixture
def sample_data():
    """Fixture providing sample test data."""
    return {
        'id': 'test-123',
        'name': 'Test Entity',
    }

@pytest.fixture
def database_connection():
    """Fixture providing test database connection."""
    conn = sqlite3.connect(':memory:')
    yield conn
    conn.close()

# Use fixtures in tests
def test_with_fixture(sample_data):
    assert sample_data['id'] == 'test-123'
```

### Parameterized Tests

```python
@pytest.mark.parametrize("input,expected", [
    ('input1', 'output1'),
    ('input2', 'output2'),
    ('input3', 'output3'),
])
def test_with_various_inputs(input, expected):
    """Test with multiple inputs using parameterization."""
    result = function_being_tested(input)
    assert result == expected
```

### Error Handling

```python
def test_raises_error_for_invalid_input():
    """Test that appropriate error is raised."""
    with pytest.raises(ValueError, match='Invalid input'):
        function_being_tested('invalid')

def test_raises_error_for_null_input():
    """Test that appropriate error is raised for None."""
    with pytest.raises(TypeError):
        function_being_tested(None)
```

### Mocking

```python
@patch('module.external_service')
def test_with_mock(mock_service):
    """Test with mocked external service."""
    mock_service.get_data.return_value = {'key': 'value'}

    result = class_being_tested.method()

    assert result == {'key': 'value'}
    mock_service.get_data.assert_called_once()
```

### Async Tests

```python
@pytest.mark.asyncio
async def test_async_function():
    """Test async function."""
    result = await async_function('input')
    assert result == 'expected'
```

---

## TypeScript Test Writing Guidelines

### File Structure

```typescript
/**
 * Test suite for ModuleName.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { functionBeingTested } from '../module'

describe('ModuleName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return expected result', () => {
    // Arrange
    const input = 'test'

    // Act
    const result = functionBeingTested(input)

    // Assert
    expect(result).toBe('expected')
  })
})
```

### Parameterized Tests

```typescript
describe('with various inputs', () => {
  it.each([
    ['input1', 'output1'],
    ['input2', 'output2'],
    ['input3', 'output3'],
  ])('should handle %s and return %s', (input: string, expected: string) => {
    const result = functionBeingTested(input)
    expect(result).toBe(expected)
  })

  it.each([
    { input: 1, expected: 2 },
    { input: 2, expected: 4 },
  ])('should double $input to get $expected', ({ input, expected }: any) => {
    const result = doubleFunction(input)
    expect(result).toBe(expected)
  })
})
```

### Async Tests

```typescript
describe('async operations', () => {
  it('should resolve with expected value', async () => {
    const result = await asyncFunction('input')
    expect(result).toBe('expected')
  })

  it('should reject with error', async () => {
    await expect(asyncFunction('invalid')).rejects.toThrow()
  })
})
```

### Mocking

```typescript
vi.mock('../external-service', () => ({
  externalService: {
    getData: vi.fn(),
  },
}))

describe('with mocked dependencies', () => {
  it('should call external service', () => {
    externalService.getData.mockReturnValue({ key: 'value' })

    const result = classBeingTested.method()

    expect(result).toEqual({ key: 'value' })
    expect(externalService.getData).toHaveBeenCalledTimes(1)
  })
})
```

### React Component Tests

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('ComponentName', () => {
  it('should render without crashing', () => {
    render(<ComponentName />)
    expect(screen.getByRole('heading')).toBeInTheDocument()
  })

  it('should handle click event', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(<ComponentName onClick={handleClick} />)
    await user.click(screen.getByRole('button'))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

---

## Integration Test Guidelines

### Database Integration

```python
def test_database_operation(test_database):
    """Test database operations."""
    # Create
    test_database.execute('INSERT INTO projects ...')
    test_database.commit()

    # Read
    result = test_database.execute('SELECT * FROM projects').fetchall()

    # Assert
    assert len(result) == 1
```

### API Integration

```typescript
describe('API Integration', () => {
  it('should create resource via API', async () => {
    const response = await request(app)
      .post('/api/resources')
      .send({ name: 'Test' })

    expect(response.status).toBe(201)
    expect(response.body.name).toBe('Test')
  })
})
```

### Workflow Integration

```python
def test_complete_workflow():
    """Test multi-step workflow."""
    # Step 1: Create project
    project = create_project('Test Project')

    # Step 2: Add tasks
    task = add_task(project.id, 'Test Task')

    # Step 3: Update task status
    update_task(task.id, status='done')

    # Verify workflow completed
    assert get_project(project.id).status == 'completed'
```

---

## Naming Conventions

### Test Files

- Python: `test_<module>.py` or `test_<feature>.py`
- TypeScript: `<name>.test.ts` or `<name>.test.tsx`

### Test Classes

- Python: `Test<ClassName>`
- TypeScript: Describe block with class/module name

### Test Functions

```python
# Good - descriptive
def test_create_agent_with_valid_data():
def test_raises_error_when_name_is_empty():
def test_updates_status_from_idle_to_running():

# Bad - vague
def test_agent():
def test_error():
def test_update():
```

```typescript
// Good - descriptive
it('should create agent with valid data', () => {})
it('should raise error when name is empty', () => {})
it('should update status from idle to running', () => {})

// Bad - vague
it('should work', () => {})
it('should fail', () => {})
it('should update', () => {})
```

### Fixture Names

```python
# Good - descriptive
@pytest.fixture
def authenticated_user():
@pytest.fixture
def test_database_with_sample_data():
@pytest.fixture
def mock_external_api_client():

# Bad - vague
@pytest.fixture
def user():
@pytest.fixture
def db():
@pytest.fixture
def client():
```

---

## Setup/Teardown Patterns

### Python

```python
class TestWithSetup:
    """Test class with setup/teardown."""

    @classmethod
    def setup_class(cls):
        """Run once before all tests in class."""
        pass

    @classmethod
    def teardown_class(cls):
        """Run once after all tests in class."""
        pass

    def setup_method(self):
        """Run before each test method."""
        pass

    def teardown_method(self):
        """Run after each test method."""
        pass

# Or use fixtures
@pytest.fixture(autouse=True)
def setup_and_teardown():
    """Setup/teardown using fixtures."""
    # Setup
    yield
    # Teardown
```

### TypeScript

```typescript
describe('Test Suite', () => {
  beforeAll(() => {
    // Run once before all tests
  })

  afterAll(() => {
    // Run once after all tests
  })

  beforeEach(() => {
    // Run before each test
  })

  afterEach(() => {
    // Run after each test
  })
})
```

---

## Assertion Best Practices

### Python

```python
# Good - specific assertions
assert result == expected_value
assert len(items) == 3
assert 'key' in response
assert user.is_authenticated() is True

# Bad - vague assertions
assert result  # What are you asserting?
assert len(items)  # What should the length be?
```

### Custom Assertions

```python
def assert_agent_structure(agent):
    """Assert agent has correct structure."""
    required_keys = ['id', 'name', 'role']
    for key in required_keys:
        assert key in agent, f"Agent missing key: {key}"
```

### TypeScript

```typescript
// Good - specific matchers
expect(result).toBe(expectedValue)
expect(result).toEqual(expectedObject)
expect(result).toHaveLength(3)
expect(result).toContain(item)

// Bad - vague matchers
expect(result).toBeTruthy()  // Too vague
expect(result).toBeDefined()  # Too vague
```

---

## Mock/Stub Usage Guidelines

### When to Mock

- External services (API calls, databases)
- File system operations
- Time-dependent operations
- Complex dependencies

### When NOT to Mock

- Simple functions
- Data transformations
- Value objects
- The code being tested

### Python Mocking

```python
# Mock a function
@patch('module.function_name')
def test_with_mock(mock_function):
    mock_function.return_value = 'mocked value'
    result = tested_function()
    assert result == 'mocked value'

# Mock a class
@patch('module.ClassName')
def test_with_class_mock(MockClass):
    instance = MockClass.return_value
    instance.method.return_value = 'result'
```

### TypeScript Mocking

```typescript
// Mock a module
vi.mock('../module', () => ({
  functionToMock: vi.fn(),
}))

// Use mock in test
it('should call mocked function', () => {
  functionToMock.mockReturnValue('mocked value')
  const result = testedFunction()
  expect(result).toBe('mocked value')
})
```

---

## Test Data Management

### Fixtures for Test Data

```python
@pytest.fixture
def sample_project():
    """Provide sample project data."""
    return {
        'id': 'test-project-123',
        'name': 'Test Project',
        'description': 'A test project',
    }

@pytest.fixture
def sample_tasks():
    """Provide sample task data."""
    return [
        {'id': 'task-1', 'title': 'Task 1'},
        {'id': 'task-2', 'title': 'Task 2'},
    ]
```

### Data Builders

```python
class ProjectBuilder:
    """Builder for creating test projects."""

    def __init__(self):
        self.data = {
            'id': 'test-project',
            'name': 'Test Project',
            'description': 'A test project',
        }

    def with_id(self, project_id):
        self.data['id'] = project_id
        return self

    def with_name(self, name):
        self.data['name'] = name
        return self

    def build(self):
        return self.data.copy()

# Usage
def test_with_builder():
    project = ProjectBuilder().with_id('custom-123').build()
    assert project['id'] == 'custom-123'
```

### Database Test Data

```python
@pytest.fixture
def populated_database(test_database):
    """Provide database with test data."""
    # Insert test data
    test_database.execute('INSERT INTO projects ...')
    test_database.commit()

    return test_database
```

---

## Error Handling in Tests

### Testing Exceptions

```python
# Python - Test specific exception
def test_raises_value_error():
    with pytest.raises(ValueError, match='Invalid input'):
        function_with_error('invalid')

# Test any exception
def test_raises_any_error():
    with pytest.raises(Exception):
        function_with_error('input')
```

```typescript
// TypeScript - Test error thrown
it('should throw error for invalid input', () => {
  expect(() => functionWithError('invalid')).toThrow()
})

// Test specific error type
it('should throw ValueError', () => {
  expect(() => functionWithError('invalid')).toThrow(ValueError)
})

// Test error message
it('should throw error with message', () => {
  expect(() => functionWithError('invalid')).toThrow('Invalid input')
})
```

### Testing Error Recovery

```python
def test_recovers_from_error():
    """Test that system recovers from errors."""
    # Initial error
    with pytest.raises(ConnectionError):
        operation_with_retry()

    # After retry, succeeds
    result = operation_with_retry()
    assert result is not None
```

### Testing Error States

```typescript
it('should show error state', () => {
  render(<Component error="Something went wrong" />)

  expect(screen.getByRole('alert')).toBeInTheDocument()
  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
})
```

---

## Test Organization

### Grouping Tests

```python
class TestAgentService:
    """Tests for AgentService."""

    class TestCreateAgent:
        """Tests for creating agents."""

        def test_with_valid_data(self):
            pass

        def test_with_invalid_data(self):
            pass

    class TestUpdateAgent:
        """Tests for updating agents."""

        def test_update_name(self):
            pass

        def test_update_status(self):
            pass
```

### Tagging Tests

```python
@pytest.mark.slow
def test_slow_operation():
    pass

@pytest.mark.integration
def test_database_integration():
    pass

# Run specific tags
# pytest -m slow
# pytest -m "not slow"
```

### Test Priority

```python
@pytest.mark.priority_high
def test_critical_feature():
    pass

@pytest.mark.priority_medium
def test_important_feature():
    pass
```

---

## Common Patterns

### Testing Async Operations

```python
@pytest.mark.asyncio
async def test_async_function():
    result = await async_function()
    assert result == 'expected'
```

```typescript
it('should handle async operation', async () => {
  const result = await asyncFunction()
  expect(result).toBe('expected')
})
```

### Testing Time-Dependent Code

```python
from unittest.mock import patch
import datetime

@patch('module.datetime')
def test_time_dependent_code(mock_datetime):
    mock_datetime.datetime.now.return_value = datetime.datetime(2024, 1, 1)
    result = time_dependent_function()
    assert result == '2024-01-01'
```

```typescript
it('should handle time-dependent code', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2024-01-01'))

  const result = timeDependentFunction()

  expect(result).toBe('2024-01-01')

  vi.useRealTimers()
})
```

### Testing Random Values

```python
from unittest.mock import patch

@patch('module.random.randint')
def test_random_dependent_code(mock_randint):
    mock_randint.return_value = 42
    result = random_dependent_function()
    assert result == 42
```

### Testing File Operations

```python
import tempfile
import os

def test_file_operations():
    with tempfile.NamedTemporaryFile(mode='w', delete=False) as f:
        f.write('test content')
        temp_path = f.name

    try:
        result = process_file(temp_path)
        assert result == 'expected'
    finally:
        os.unlink(temp_path)
```

---

## Additional Resources

### Templates

- Python Unit Test: `tests/templates/python-unit-test.template.py`
- Python Integration Test: `tests/templates/python-integration-test.template.py`
- TypeScript Unit Test: `tests/templates/typescript-unit-test.template.ts`
- TypeScript Integration Test: `tests/templates/typescript-integration-test.template.ts`
- Component Test: `tests/templates/component-test.template.tsx`

### Examples

- Python Basic: `tests/examples/python-basic-example.test.py`
- TypeScript Basic: `tests/examples/typescript-basic-example.test.ts`
- Integration Test: `tests/examples/integration-test-example.test.ts`
- API Test: `tests/examples/api-test-example.test.ts`

### Documentation

- Testing overview: [testing/README.md](../README.md)
- Test architecture: [TEST_ARCHITECTURE.md](../TEST_ARCHITECTURE.md)
- Pytest documentation: https://docs.pytest.org/
- Vitest documentation: https://vitest.dev/
- Testing Library: https://testing-library.com/

---

## Quick Checklist

Before committing your tests, ensure:

- [ ] Tests are independent and can run in any order
- [ ] Test names clearly describe what is being tested
- [ ] Each test verifies one behavior
- [ ] Tests follow AAA pattern (Arrange, Act, Assert)
- [ ] Assertions are specific and meaningful
- [ ] Error cases are tested
- [ ] Edge cases are tested
- [ ] Mocks are used appropriately
- [ ] Test data is isolated from production
- [ ] Tests are fast enough for development workflow
- [ ] Tests pass consistently (not flaky)
- [ ] Code coverage is maintained or improved

---

## Getting Help

If you need help with testing:

1. Check existing tests for examples
2. Read the templates in `tests/templates/`
3. Review examples in `tests/examples/`
4. Consult the main TESTING.md guide
5. Ask in team chat or create an issue
