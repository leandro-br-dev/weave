"""
Sample data fixtures for testing.

This module provides common test data that can be reused across tests.
"""


def sample_project_data():
    """Return sample project data."""
    return {
        'id': 'test-project-123',
        'name': 'Test Project',
        'description': 'A test project for testing',
    }


def sample_kanban_task_data():
    """Return sample kanban task data."""
    return {
        'id': 'task-1',
        'project_id': 'test-project-123',
        'title': 'Test Task',
        'description': 'A test task',
        'column': 'backlog',
        'priority': 3,
        'pipeline_status': 'idle',
    }


def sample_plan_data():
    """Return sample plan data."""
    return {
        'id': 'plan-1',
        'project_id': 'test-project-123',
        'name': 'Test Plan',
        'tasks': [
            {
                'id': 'task-1',
                'name': 'First task',
                'prompt': 'Do something',
                'cwd': '/path/to/project',
                'workspace': '/path/to/workspace',
                'tools': ['Read', 'Write'],
                'permission_mode': 'acceptEdits',
                'depends_on': [],
            }
        ],
        'status': 'pending',
    }


def sample_planning_context_data():
    """Return sample planning context data."""
    return {
        'project': {
            'name': 'weave',
            'description': 'Multi-agent project management system',
        },
        'environments': [
            {
                'name': 'dev',
                'type': 'local-wsl',
                'project_path': '/root/projects/weave',
            },
            {
                'name': 'production',
                'type': 'ssh',
                'project_path': '/var/www/weave',
            },
        ],
        'agents': [
            {
                'name': 'planner',
                'role': 'planner',
                'workspace_path': '/root/projects/weave/projects/weave/agents/planner',
            },
            {
                'name': 'coder-backend',
                'role': 'coder',
                'workspace_path': '/root/projects/weave/projects/weave/agents/coder-backend',
            },
            {
                'name': 'reviewer',
                'role': 'reviewer',
                'workspace_path': '/root/projects/weave/projects/weave/agents/reviewer',
            },
        ],
    }


def sample_agent_data():
    """Return sample agent data."""
    return {
        'name': 'test-agent',
        'role': 'coder',
        'workspace_path': '/path/to/workspace',
    }


def sample_environment_data():
    """Return sample environment data."""
    return {
        'name': 'dev',
        'type': 'local-wsl',
        'project_path': '/root/projects/weave',
    }
