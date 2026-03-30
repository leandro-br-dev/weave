"""
Test fixtures for Python tests.

Provides reusable test data, factories, and utilities to ensure
test consistency and isolation.
"""

import random
import string
from datetime import datetime
from typing import Dict, Any, Optional, List


def generate_id(prefix: str = "test") -> str:
    """
    Generate a unique test ID.

    Args:
        prefix: Prefix for the ID

    Returns:
        Unique identifier string
    """
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"{prefix}-{timestamp}-{random_str}"


def generate_token() -> str:
    """
    Generate a test authentication token.

    Returns:
        Test token string
    """
    return f"test-token-{generate_id()}"


# Test data factories

def create_project_data(overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Create test project data.

    Args:
        overrides: Optional dict of fields to override

    Returns:
        Project data dict
    """
    data = {
        "id": generate_id("project"),
        "name": "Test Project",
        "description": "A test project for automated testing",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }
    if overrides:
        data.update(overrides)
    return data


def create_plan_data(overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Create test plan data.

    Args:
        overrides: Optional dict of fields to override

    Returns:
        Plan data dict
    """
    data = {
        "id": generate_id("plan"),
        "name": "Test Plan",
        "tasks": "Task 1\nTask 2\nTask 3",
        "status": "pending",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }
    if overrides:
        data.update(overrides)
    return data


def create_kanban_task_data(project_id: str, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Create test kanban task data.

    Args:
        project_id: Project ID for the task
        overrides: Optional dict of fields to override

    Returns:
        Kanban task data dict
    """
    data = {
        "id": generate_id("task"),
        "project_id": project_id,
        "title": "Test Task",
        "description": "A test task for automated testing",
        "column": "backlog",
        "priority": 3,
        "pipeline_status": "idle",
        "workflow_id": None,
        "error_message": None,
        "result_status": None,
        "result_notes": None,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }
    if overrides:
        data.update(overrides)
    return data


def create_workspace_data(project_id: str, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Create test workspace data.

    Args:
        project_id: Project ID for the workspace
        overrides: Optional dict of fields to override

    Returns:
        Workspace data dict
    """
    data = {
        "id": generate_id("workspace"),
        "project_id": project_id,
        "name": "Test Workspace",
        "path": f"/tmp/test-workspace-{generate_id()}",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }
    if overrides:
        data.update(overrides)
    return data


def create_agent_data(overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Create test agent data.

    Args:
        overrides: Optional dict of fields to override

    Returns:
        Agent data dict
    """
    data = {
        "id": generate_id("agent"),
        "name": "Test Agent",
        "role": "developer",
        "status": "idle",
        "workspace_path": "/tmp/test-workspace",
    }
    if overrides:
        data.update(overrides)
    return data


def create_approval_data(overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Create test approval request data.

    Args:
        overrides: Optional dict of fields to override

    Returns:
        Approval data dict
    """
    data = {
        "id": generate_id("approval"),
        "plan_id": generate_id("plan"),
        "task_id": generate_id("task"),
        "tool": "Bash",
        "input_data": {"command": "ls -la"},
        "reason": "Test approval",
        "status": "pending",
        "created_at": datetime.now().isoformat(),
    }
    if overrides:
        data.update(overrides)
    return data


def create_log_entry_data(plan_id: str, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Create test log entry data.

    Args:
        plan_id: Plan ID for the log
        overrides: Optional dict of fields to override

    Returns:
        Log entry data dict
    """
    data = {
        "id": generate_id("log"),
        "plan_id": plan_id,
        "task_id": generate_id("task"),
        "level": "info",
        "message": "Test log message",
        "created_at": datetime.now().isoformat(),
    }
    if overrides:
        data.update(overrides)
    return data


# Batch creators

def create_projects(count: int) -> List[Dict[str, Any]]:
    """
    Create multiple test projects.

    Args:
        count: Number of projects to create

    Returns:
        List of project data dicts
    """
    return [create_project_data({"name": f"Test Project {i + 1}"}) for i in range(count)]


def create_kanban_tasks(project_id: str, count: int) -> List[Dict[str, Any]]:
    """
    Create multiple test kanban tasks.

    Args:
        project_id: Project ID for tasks
        count: Number of tasks to create

    Returns:
        List of kanban task data dicts
    """
    columns = ["backlog", "todo", "planning", "in_progress", "done"]
    return [
        create_kanban_task_data(
            project_id,
            {
                "title": f"Test Task {i + 1}",
                "description": f"Test task {i + 1} for automated testing",
                "column": columns[i % len(columns)],
                "priority": (i % 5) + 1,
            },
        )
        for i in range(count)
    ]


def create_plan_logs(plan_id: str, count: int) -> List[Dict[str, Any]]:
    """
    Create multiple test log entries.

    Args:
        plan_id: Plan ID for logs
        count: Number of logs to create

    Returns:
        List of log entry data dicts
    """
    levels = ["debug", "info", "warn", "error"]
    return [
        create_log_entry_data(
            plan_id,
            {
                "task_id": generate_id(f"task-{i}"),
                "level": levels[i % len(levels)],
                "message": f"Test log message {i + 1}",
            },
        )
        for i in range(count)
    ]


# Test scenarios

class TestScenarios:
    """
    Pre-built test scenarios for common testing patterns.
    """

    @staticmethod
    def kanban_workflow() -> Dict[str, Any]:
        """
        Create a complete kanban workflow scenario.

        Returns:
            Dict with project and tasks for testing kanban workflows
        """
        project = create_project_data({"name": "Kanban Test Project"})
        tasks = create_kanban_tasks(project["id"], 5)
        return {"project": project, "tasks": tasks}

    @staticmethod
    def approval_workflow() -> Dict[str, Any]:
        """
        Create a complete approval workflow scenario.

        Returns:
            Dict with plan and approval requests for testing approval flows
        """
        plan = create_plan_data()
        approvals = [
            create_approval_data(
                {
                    "plan_id": plan["id"],
                    "task_id": generate_id("task-1"),
                    "tool": "Bash",
                    "input_data": {"command": "rm -rf /tmp/test"},
                    "reason": "Matches deny rule: Bash(rm -rf *)",
                }
            ),
            create_approval_data(
                {
                    "plan_id": plan["id"],
                    "task_id": generate_id("task-2"),
                    "tool": "Write",
                    "input_data": {"path": "/etc/config"},
                    "reason": "Matches deny rule: Write(/etc/*)",
                }
            ),
        ]
        return {"plan": plan, "approvals": approvals}

    @staticmethod
    def multi_agent_project() -> Dict[str, Any]:
        """
        Create a multi-agent project scenario.

        Returns:
            Dict with project and multiple agents for testing multi-agent workflows
        """
        project = create_project_data({"name": "Multi-Agent Test Project"})
        agents = [
            create_agent_data(
                {
                    "name": "Code Agent",
                    "role": "developer",
                    "workspace_path": f"/tmp/agent-{i}-workspace",
                }
            )
            for i in range(3)
        ]
        return {"project": project, "agents": agents}


# API response helpers

def api_response(data: Any = None, error: Optional[str] = None) -> Dict[str, Any]:
    """
    Create a standardized API response envelope.

    Args:
        data: Response data
        error: Error message if any

    Returns:
        API response dict
    """
    response = {"error": error}
    if data is not None:
        response["data"] = data
    return response


def paginated_response(items: List[Any], page: int = 1, per_page: int = 10) -> Dict[str, Any]:
    """
    Create a paginated API response.

    Args:
        items: List of items
        page: Current page number
        per_page: Items per page

    Returns:
        Paginated response dict
    """
    total = len(items)
    start = (page - 1) * per_page
    end = start + per_page
    page_items = items[start:end]

    return {
        "data": page_items,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": (total + per_page - 1) // per_page,
        },
        "error": None,
    }
