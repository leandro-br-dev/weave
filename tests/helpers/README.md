# Test Helpers

Utility functions and helper classes for use across all test suites.

## Purpose

Test helpers provide reusable utility functions that make writing tests easier and more consistent.

## Helper Types

### Assertion Helpers
```python
# assertions.py
def assert_agent_exists(agent_id, session):
    """Assert that an agent exists in the database."""
    agent = session.query(Agent).get(agent_id)
    assert agent is not None
    return agent

def assert_response_status(response, expected_status):
    """Assert HTTP response status."""
    assert response.status_code == expected_status
```

### Mock Helpers
```python
# mocks.py
def create_mock_agent(overrides=None):
    """Create a mock agent with optional overrides."""
    default = {
        "id": "test-agent-1",
        "name": "Test Agent",
        "type": "assistant"
    }
    if overrides:
        default.update(overrides)
    return Mock(**default)
```

### Test Data Generators
```python
# generators.py
def generate_random_agent_name():
    """Generate a random agent name for testing."""
    return f"agent-{uuid.uuid4().hex[:8]}"

def generate_test_config():
    """Generate a test configuration."""
    return {
        "model": "claude-3-5-sonnet",
        "temperature": random.uniform(0.0, 1.0)
    }
```

### HTTP Client Helpers
```python
# http_helpers.py
def create_test_client(base_url="http://localhost:3000"):
    """Create a test HTTP client."""
    return AgentsManagerClient(base_url=base_url)

def make_authenticated_request(client, endpoint, token):
    """Make an authenticated request to the API."""
    return client.get(endpoint, headers={"Authorization": f"Bearer {token}"})
```

## Using Helpers

```python
# tests/integration/test_agents.py
from helpers.assertions import assert_agent_exists
from helpers.generators import generate_random_agent_name

def test_agent_creation(client, db_session):
    """Test agent creation."""
    agent_name = generate_random_agent_name()
    agent = client.create_agent(name=agent_name)
    assert_agent_exists(agent.id, db_session)
```

## Guidelines

1. **Keep helpers simple**: Each helper should do one thing well
2. **Document helpers**: Add docstrings and usage examples
3. **Make helpers reusable**: Use them across multiple test files
4. **Test your helpers**: Write tests for your test helpers
5. **Avoid over-abstraction**: Don't create helpers that are more complex than the tests themselves
