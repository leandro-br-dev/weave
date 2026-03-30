"""
Database helpers for testing.

This module provides utilities for setting up and managing test databases.
"""

import sqlite3
from pathlib import Path
from typing import Optional


def create_in_memory_db() -> sqlite3.Connection:
    """
    Create an in-memory SQLite database for testing.

    Returns:
        SQLite connection object
    """
    conn = sqlite3.connect(':memory:')
    conn.row_factory = sqlite3.Row
    return conn


def setup_kanban_schema(conn: sqlite3.Connection):
    """
    Set up the kanban database schema.

    Args:
        conn: SQLite connection
    """
    conn.executescript('''
        CREATE TABLE projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            settings TEXT DEFAULT '{}'
        );

        CREATE TABLE kanban_tasks (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            column TEXT NOT NULL DEFAULT 'backlog',
            priority INTEGER NOT NULL DEFAULT 3,
            order_index INTEGER,
            workflow_id TEXT,
            pipeline_status TEXT NOT NULL DEFAULT 'idle',
            error_message TEXT,
            result_status TEXT,
            result_notes TEXT,
            planning_started_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (workflow_id) REFERENCES plans(id) ON DELETE SET NULL
        );

        CREATE TABLE plans (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            tasks TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            result_status TEXT,
            result_notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
    ''')


def insert_test_project(conn: sqlite3.Connection, project_id: str, name: str, description: str = ""):
    """
    Insert a test project into the database.

    Args:
        conn: SQLite connection
        project_id: Project ID
        name: Project name
        description: Project description (default: empty)
    """
    conn.execute(
        'INSERT INTO projects (id, name, description) VALUES (?, ?, ?)',
        (project_id, name, description)
    )


def insert_test_kanban_task(
    conn: sqlite3.Connection,
    task_id: str,
    project_id: str,
    title: str,
    description: str = "",
    column: str = "backlog",
    pipeline_status: str = "idle",
):
    """
    Insert a test kanban task into the database.

    Args:
        conn: SQLite connection
        task_id: Task ID
        project_id: Project ID
        title: Task title
        description: Task description (default: empty)
        column: Task column (default: backlog)
        pipeline_status: Pipeline status (default: idle)
    """
    conn.execute(
        '''INSERT INTO kanban_tasks
           (id, project_id, title, description, column, pipeline_status)
           VALUES (?, ?, ?, ?, ?, ?)''',
        (task_id, project_id, title, description, column, pipeline_status)
    )


def insert_test_plan(
    conn: sqlite3.Connection,
    plan_id: str,
    project_id: str,
    name: str,
    tasks: str,
    status: str = "pending",
):
    """
    Insert a test plan into the database.

    Args:
        conn: SQLite connection
        plan_id: Plan ID
        project_id: Project ID
        name: Plan name
        tasks: Plan tasks JSON string
        status: Plan status (default: pending)
    """
    conn.execute(
        'INSERT INTO plans (id, project_id, name, tasks, status) VALUES (?, ?, ?, ?, ?)',
        (plan_id, project_id, name, tasks, status)
    )


def setup_test_database() -> sqlite3.Connection:
    """
    Create and set up a complete test database with sample data.

    Returns:
        SQLite connection with schema and sample data
    """
    conn = create_in_memory_db()
    setup_kanban_schema(conn)

    # Insert sample project
    insert_test_project(conn, 'test-project-123', 'Test Project', 'A test project')

    # Insert sample tasks
    insert_test_kanban_task(
        conn, 'task-1', 'test-project-123', 'Test Task 1', 'First test task', 'backlog', 'idle'
    )
    insert_test_kanban_task(
        conn, 'task-2', 'test-project-123', 'Test Task 2', 'Second test task', 'planning', 'idle'
    )

    return conn


def get_pending_pipeline_tasks(conn: sqlite3.Connection, project_id: str) -> list:
    """
    Query pending pipeline tasks from the database.

    Args:
        conn: SQLite connection
        project_id: Project ID

    Returns:
        List of pending pipeline tasks
    """
    return conn.execute(
        '''SELECT * FROM kanban_tasks
           WHERE project_id = ?
             AND column = 'planning'
             AND pipeline_status = 'idle'
             AND (workflow_id IS NULL OR workflow_id = '')''',
        (project_id,)
    ).fetchall()
