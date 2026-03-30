"""
Custom assertion helpers for testing.

This module provides reusable assertion functions for common test scenarios.
"""


def assert_kanban_task_structure(task, expected_keys=None):
    """
    Assert that a kanban task has the correct structure.

    Args:
        task: The task dict to validate
        expected_keys: Optional list of expected keys (defaults to standard keys)

    Raises:
        AssertionError: If task structure is invalid
    """
    if expected_keys is None:
        expected_keys = [
            'id',
            'project_id',
            'title',
            'description',
            'column',
            'priority',
            'pipeline_status',
        ]

    for key in expected_keys:
        assert key in task, f"Task missing required key: {key}"


def assert_plan_structure(plan, expected_keys=None):
    """
    Assert that a plan has the correct structure.

    Args:
        plan: The plan dict to validate
        expected_keys: Optional list of expected keys (defaults to standard keys)

    Raises:
        AssertionError: If plan structure is invalid
    """
    if expected_keys is None:
        expected_keys = ['id', 'project_id', 'name', 'tasks', 'status']

    for key in expected_keys:
        assert key in plan, f"Plan missing required key: {key}"

    # Assert tasks is a list
    assert isinstance(plan['tasks'], list), "Plan tasks must be a list"


def assert_planning_context_structure(context):
    """
    Assert that planning context has the correct structure.

    Args:
        context: The planning context dict to validate

    Raises:
        AssertionError: If context structure is invalid
    """
    expected_keys = ['project', 'environments', 'agents']

    for key in expected_keys:
        assert key in context, f"Planning context missing required key: {key}"

    # Assert environments and agents are lists
    assert isinstance(context['environments'], list), "Environments must be a list"
    assert isinstance(context['agents'], list), "Agents must be a list"


def assert_agent_structure(agent):
    """
    Assert that an agent has the correct structure.

    Args:
        agent: The agent dict to validate

    Raises:
        AssertionError: If agent structure is invalid
    """
    expected_keys = ['name', 'role', 'workspace_path']

    for key in expected_keys:
        assert key in agent, f"Agent missing required key: {key}"


def assert_environment_structure(env):
    """
    Assert that an environment has the correct structure.

    Args:
        env: The environment dict to validate

    Raises:
        AssertionError: If environment structure is invalid
    """
    expected_keys = ['name', 'type', 'project_path']

    for key in expected_keys:
        assert key in env, f"Environment missing required key: {key}"


def assert_pipeline_transition(task, from_status, to_status):
    """
    Assert that a task transitioned between pipeline statuses.

    Args:
        task: The task dict
        from_status: Expected previous status
        to_status: Expected current status

    Raises:
        AssertionError: If transition is invalid
    """
    current_status = task.get('pipeline_status')
    assert current_status == to_status, f"Expected status {to_status}, got {current_status}"


def assert_task_column(task, expected_column):
    """
    Assert that a task is in the expected column.

    Args:
        task: The task dict
        expected_column: Expected column value

    Raises:
        AssertionError: If column is incorrect
    """
    actual_column = task.get('column')
    assert actual_column == expected_column, f"Expected column {expected_column}, got {actual_column}"


def assert_task_has_workflow(task):
    """
    Assert that a task has an associated workflow.

    Args:
        task: The task dict

    Raises:
        AssertionError: If workflow is missing
    """
    assert 'workflow_id' in task, "Task missing workflow_id"
    assert task['workflow_id'], "Task has empty workflow_id"


def assert_task_result(task, expected_status, notes=None):
    """
    Assert that a task has a result with expected status.

    Args:
        task: The task dict
        expected_status: Expected result status (success, failure, etc.)
        notes: Optional expected result notes

    Raises:
        AssertionError: If result is missing or incorrect
    """
    assert 'result_status' in task, "Task missing result_status"
    assert task['result_status'] == expected_status, f"Expected result {expected_status}, got {task['result_status']}"

    if notes:
        assert 'result_notes' in task, "Task missing result_notes"
        assert notes in task['result_notes'], f"Expected notes '{notes}' not found in '{task['result_notes']}'"
