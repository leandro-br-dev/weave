"""
Test scenario fixtures for common testing patterns.

This module provides reusable test scenarios for integration and e2e tests.
"""


def scenario_kanban_task_lifecycle():
    """
    Scenario: Complete kanban task lifecycle from backlog to done.

    Returns a dict with task states for each stage:
    - backlog: Initial state
    - planning: When planning starts
    - executing: When being executed
    - review: Under review
    - done: Completed
    """
    return {
        'backlog': {
            'id': 'task-lifecycle-1',
            'title': 'Implement feature X',
            'description': 'Add feature X to the system',
            'column': 'backlog',
            'pipeline_status': 'idle',
        },
        'planning': {
            'id': 'task-lifecycle-1',
            'title': 'Implement feature X',
            'description': 'Add feature X to the system',
            'column': 'planning',
            'pipeline_status': 'running',
            'workflow_id': 'plan-123',
        },
        'executing': {
            'id': 'task-lifecycle-1',
            'title': 'Implement feature X',
            'description': 'Add feature X to the system',
            'column': 'doing',
            'pipeline_status': 'running',
            'workflow_id': 'exec-456',
        },
        'review': {
            'id': 'task-lifecycle-1',
            'title': 'Implement feature X',
            'description': 'Add feature X to the system',
            'column': 'review',
            'pipeline_status': 'done',
            'workflow_id': 'exec-456',
            'result_status': 'success',
        },
        'done': {
            'id': 'task-lifecycle-1',
            'title': 'Implement feature X',
            'description': 'Add feature X to the system',
            'column': 'done',
            'pipeline_status': 'done',
            'result_status': 'success',
            'result_notes': 'Feature implemented successfully',
        },
    }


def scenario_pipeline_error_recovery():
    """
    Scenario: Pipeline execution with error recovery.

    Returns a dict with task states for error scenario:
    - initial: Task starts in planning
    - error: Task encounters error
    - recovered: Task recovered and succeeded
    """
    return {
        'initial': {
            'id': 'task-error-1',
            'title': 'Fix bug Y',
            'description': 'Fix critical bug in component Y',
            'column': 'planning',
            'pipeline_status': 'running',
        },
        'error': {
            'id': 'task-error-1',
            'title': 'Fix bug Y',
            'description': 'Fix critical bug in component Y',
            'column': 'planning',
            'pipeline_status': 'error',
            'error_message': 'Failed to execute: timeout',
        },
        'recovered': {
            'id': 'task-error-1',
            'title': 'Fix bug Y',
            'description': 'Fix critical bug in component Y',
            'column': 'done',
            'pipeline_status': 'done',
            'result_status': 'success',
            'result_notes': 'Bug fixed after retry',
        },
    }


def scenario_multi_agent_collaboration():
    """
    Scenario: Multiple agents collaborating on a task.

    Returns a dict with agents and their roles.
    """
    return {
        'task': {
            'id': 'task-multi-1',
            'title': 'Build authentication system',
            'description': 'Implement complete authentication system',
        },
        'agents': [
            {
                'name': 'planner',
                'role': 'planner',
                'workspace_path': '/workspaces/planner',
            },
            {
                'name': 'backend-coder',
                'role': 'coder',
                'workspace_path': '/workspaces/backend-coder',
            },
            {
                'name': 'frontend-coder',
                'role': 'coder',
                'workspace_path': '/workspaces/frontend-coder',
            },
            {
                'name': 'reviewer',
                'role': 'reviewer',
                'workspace_path': '/workspaces/reviewer',
            },
        ],
        'plan': {
            'id': 'plan-multi-1',
            'name': 'Authentication System Implementation',
            'tasks': [
                {'id': 't1', 'name': 'Design auth schema', 'agent': 'planner'},
                {'id': 't2', 'name': 'Implement backend', 'agent': 'backend-coder'},
                {'id': 't3', 'name': 'Implement frontend', 'agent': 'frontend-coder'},
                {'id': 't4', 'name': 'Review implementation', 'agent': 'reviewer'},
            ],
        },
    }
