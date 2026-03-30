# Integration Tests

Integration tests that verify interactions between multiple components.

## Purpose

Integration tests verify that different components work together correctly. These tests should:

- Test interactions between 2+ components
- Use real dependencies (database, API, etc.)
- Test realistic scenarios
- Be slower than unit tests but faster than E2E tests

## Naming Conventions

- Files: `test_<feature>_integration.py`
- Classes: `Test<FeatureName>Integration`
- Functions: `test_<scenario>_<outcome>`

## Example Structure

```python
# test_agent_kanban_integration.py
import pytest
from models import Agent, KanbanColumn
from services import AgentService, KanbanService

class TestAgentKanbanIntegration:
    def test_agent_move_to_kanban_column(self, db_session):
        # Create agent and column
        agent = AgentService.create(name="test-agent")
        column = KanbanService.create_column(name="In Progress")

        # Move agent to column
        result = KanbanService.move_agent(agent.id, column.id)

        # Verify integration
        assert result.agent_id == agent.id
        assert result.column_id == column.id
        assert agent.current_column == column
```

## Running Tests

```bash
# Run all integration tests
pytest tests/integration/

# Run specific test file
pytest tests/integration/test_agent_kanban_integration.py

# Run with database
pytest tests/integration/ --db-url=postgresql://localhost/test
```

## Guidelines

1. **Test realistic workflows**: Model actual usage patterns
2. **Use test databases**: Don't use production data
3. **Clean up after tests**: Reset state between tests
4. **Test error scenarios**: Verify graceful failure handling
5. **Mock external services**: Don't depend on external APIs
