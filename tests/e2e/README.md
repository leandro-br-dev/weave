# End-to-End Tests

End-to-end tests that verify complete user workflows and system behavior.

## Purpose

E2E tests verify that the entire system works correctly from start to finish. These tests should:

- Test complete user workflows
- Use the full system (API, database, UI)
- Simulate real user behavior
- Be the slowest but most comprehensive tests

## Naming Conventions

- Files: `test_<workflow>_e2e.py` or `e2e_<workflow>.test.ts`
- Classes: `Test<WorkflowName>E2E`
- Functions: `test_<complete_workflow>`

## Example Structure

```python
# test_agent_lifecycle_e2e.py
import pytest
from client import AgentsManagerClient

class TestAgentLifecycleE2E:
    def test_complete_agent_workflow(self):
        client = AgentsManagerClient(base_url="http://localhost:3000")

        # Create agent
        agent = client.agents.create(name="test-agent", type="assistant")
        assert agent.id is not None
        assert agent.status == "created"

        # Move to backlog
        client.kanban.move_agent(agent.id, "backlog")
        agent = client.agents.get(agent.id)
        assert agent.kanban_column == "backlog"

        # Start working on agent
        client.kanban.move_agent(agent.id, "in-progress")
        agent = client.agents.get(agent.id)
        assert agent.kanban_column == "in-progress"

        # Complete agent
        client.kanban.move_agent(agent.id, "done")
        agent = client.agents.get(agent.id)
        assert agent.kanban_column == "done"
```

## Running Tests

```bash
# Run all E2E tests
pytest tests/e2e/

# Run specific test file
pytest tests/e2e/test_agent_lifecycle_e2e.py

# Run with specific environment
ENV=testing pytest tests/e2e/
```

## Guidelines

1. **Test critical paths**: Focus on important user workflows
2. **Use realistic data**: Don't use obviously fake data
3. **Test happy paths**: Verify that normal workflows work
4. **Test error recovery**: Verify graceful error handling
5. **Keep tests independent**: Each test should set up its own state
6. **Clean up after tests**: Remove test data after completion

## Common Workflows to Test

- Agent creation and lifecycle
- Kanban board operations
- Project management
- Session creation and management
- Approval workflows
- Multi-agent interactions
