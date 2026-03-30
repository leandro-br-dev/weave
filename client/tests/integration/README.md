# Client Integration Tests

Integration tests for client API interactions with the server.

## Purpose

Integration tests verify that the client correctly interacts with the API server.

## Test Structure

```python
# test_agents_integration.py
import pytest
from client import AgentsManagerClient
from client.testing import create_test_server, cleanup_test_server

@pytest.fixture
def client():
    """Create a test client."""
    server = create_test_server()
    yield AgentsManagerClient(base_url=server.url)
    cleanup_test_server(server)

class TestAgentsIntegration:
    def test_create_agent(self, client):
        """Test creating an agent via the API."""
        agent = client.agents.create(name="test-agent", type="assistant")

        assert agent.id is not None
        assert agent.name == "test-agent"
        assert agent.type == "assistant"

    def test_get_agent(self, client):
        """Test retrieving an agent via the API."""
        created = client.agents.create(name="test-agent")
        retrieved = client.agents.get(created.id)

        assert retrieved.id == created.id
        assert retrieved.name == "test-agent"

    def test_list_agents(self, client):
        """Test listing agents via the API."""
        client.agents.create(name="agent-1")
        client.agents.create(name="agent-2")

        agents = client.agents.list()

        assert len(agents) >= 2
        assert any(a.name == "agent-1" for a in agents)
        assert any(a.name == "agent-2" for a in agents)

    def test_update_agent(self, client):
        """Test updating an agent via the API."""
        agent = client.agents.create(name="test-agent")
        updated = client.agents.update(agent.id, name="updated-agent")

        assert updated.id == agent.id
        assert updated.name == "updated-agent"

    def test_delete_agent(self, client):
        """Test deleting an agent via the API."""
        agent = client.agents.create(name="test-agent")
        client.agents.delete(agent.id)

        with pytest.raises(NotFoundError):
            client.agents.get(agent.id)
```

## Running Tests

```bash
# Run all integration tests
pytest client/tests/integration/

# Run specific file
pytest client/tests/integration/test_agents_integration.py

# Run with specific API server
API_URL=http://localhost:3000 pytest client/tests/integration/
```

## Setup

Integration tests require:
1. API server running (or test server)
2. Test database available
3. Clean state between tests
4. Proper authentication tokens

## Guidelines

1. **Use test server**: Don't use production servers
2. **Clean up after tests**: Remove test data after each test
3. **Test realistic scenarios**: Use realistic data and requests
4. **Test error cases**: Verify proper error handling
5. **Mock external dependencies**: Don't depend on external services
6. **Use fixtures**: Set up and tear down test environment properly

## Common Patterns

### Testing CRUD Operations
```python
def test_crud_operations(client):
    # Create
    created = client.agents.create(name="test")
    assert created.id is not None

    # Read
    retrieved = client.agents.get(created.id)
    assert retrieved.name == "test"

    # Update
    updated = client.agents.update(created.id, name="updated")
    assert updated.name == "updated"

    # Delete
    client.agents.delete(created.id)
    with pytest.raises(NotFoundError):
        client.agents.get(created.id)
```

### Testing Pagination
```python
def test_pagination(client):
    # Create multiple items
    for i in range(25):
        client.agents.create(name=f"agent-{i}")

    # Get first page
    page1 = client.agents.list(page=1, limit=10)
    assert len(page1.items) == 10
    assert page1.total >= 25

    # Get second page
    page2 = client.agents.list(page=2, limit=10)
    assert len(page2.items) == 10
    assert page2.items[0].id != page1.items[0].id
```

### Testing Filtering
```python
def test_filtering(client):
    client.agents.create(name="agent-1", type="assistant")
    client.agents.create(name="agent-2", type="worker")

    assistants = client.agents.list(type="assistant")
    assert all(a.type == "assistant" for a in assistants)
```

### Testing Error Handling
```python
def test_not_found_error(client):
    with pytest.raises(NotFoundError):
        client.agents.get("non-existent-id")

def test_validation_error(client):
    with pytest.raises(ValidationError):
        client.agents.create(name="")  # Empty name
```

### Testing Authentication
```python
def test_unauthenticated_request():
    client = AgentsManagerClient(base_url="http://localhost:3000")
    with pytest.raises(AuthenticationError):
        client.agents.list()

def test_authenticated_request():
    client = AgentsManagerClient(
        base_url="http://localhost:3000",
        token="valid-token"
    )
    agents = client.agents.list()
    assert isinstance(agents, list)
```
