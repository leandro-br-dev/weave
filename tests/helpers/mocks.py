"""
Mock helpers for testing.

This module provides reusable mock objects and factory functions.
"""

from unittest.mock import Mock


def mock_http_response(data, error=None, status_code=200):
    """
    Create a mock HTTP response object.

    Args:
        data: Response data dict
        error: Optional error message
        status_code: HTTP status code (default: 200)

    Returns:
        Mock response object
    """
    mock_response = Mock()
    mock_response.json.return_value = {"data": data, "error": error}
    mock_response.status_code = status_code
    return mock_response


def mock_daemon_client(server_url="http://localhost:3001", token="test-token"):
    """
    Create a mock DaemonClient.

    Args:
        server_url: Server URL (default: http://localhost:3001)
        token: Auth token (default: test-token)

    Returns:
        Mock DaemonClient instance
    """
    from unittest.mock import patch

    with patch("orchestrator.daemon_client.httpx.Client") as mock_httpx:
        mock_httpx_instance = Mock()
        mock_httpx.return_value = mock_httpx_instance
        from orchestrator.daemon_client import DaemonClient

        client = DaemonClient(server_url, token)
        client._client = mock_httpx_instance
        return client, mock_httpx_instance


def mock_project(id="project-123", name="Test Project", description="A test project"):
    """
    Create a mock project dict.

    Args:
        id: Project ID (default: project-123)
        name: Project name (default: Test Project)
        description: Project description (default: A test project)

    Returns:
        Project dict
    """
    return {
        'id': id,
        'name': name,
        'description': description,
    }


def mock_kanban_task(id="task-1", project_id="project-123", title="Test Task", column="backlog"):
    """
    Create a mock kanban task dict.

    Args:
        id: Task ID (default: task-1)
        project_id: Project ID (default: project-123)
        title: Task title (default: Test Task)
        column: Task column (default: backlog)

    Returns:
        Kanban task dict
    """
    return {
        'id': id,
        'project_id': project_id,
        'title': title,
        'description': 'A test task',
        'column': column,
        'priority': 3,
        'pipeline_status': 'idle',
    }


def mock_plan(id="plan-1", project_id="project-123", name="Test Plan", tasks=None):
    """
    Create a mock plan dict.

    Args:
        id: Plan ID (default: plan-1)
        project_id: Project ID (default: project-123)
        name: Plan name (default: Test Plan)
        tasks: List of plan tasks (default: empty list)

    Returns:
        Plan dict
    """
    if tasks is None:
        tasks = []

    return {
        'id': id,
        'project_id': project_id,
        'name': name,
        'tasks': tasks,
        'status': 'pending',
    }


def mock_agent(name="test-agent", role="coder", workspace_path="/path/to/workspace"):
    """
    Create a mock agent dict.

    Args:
        name: Agent name (default: test-agent)
        role: Agent role (default: coder)
        workspace_path: Workspace path (default: /path/to/workspace)

    Returns:
        Agent dict
    """
    return {
        'name': name,
        'role': role,
        'workspace_path': workspace_path,
    }


def mock_environment(name="dev", type="local-wsl", project_path="/path/to/project"):
    """
    Create a mock environment dict.

    Args:
        name: Environment name (default: dev)
        type: Environment type (default: local-wsl)
        project_path: Project path (default: /path/to/project)

    Returns:
        Environment dict
    """
    return {
        'name': name,
        'type': type,
        'project_path': project_path,
    }
