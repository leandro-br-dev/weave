#!/usr/bin/env python3
"""
Python Integration Test Template

This template provides a starting point for writing integration tests in Python.
Integration tests verify that multiple components work together correctly.

BEST PRACTICES:
- Test real interactions between components (not mocked)
- Use test databases/fixtures that are isolated from production
- Clean up test data after each test
- Use transactions and rollbacks to avoid side effects
- Test database operations, API calls, and external service integrations
- Use the real database but with test data
- Keep tests independent and repeatable
- Use setUp/tearDown or fixtures for database setup
"""

from typing import Any, Dict, List
import pytest
import sqlite3
import tempfile
import os
from pathlib import Path
# Import modules you're testing
# from client import AgentService
# from orchestrator import DaemonClient


# =============================================================================
# FIXTURES
# Fixtures for integration test setup and teardown
# =============================================================================

@pytest.fixture
def test_database() -> sqlite3.Connection:
    """
    Fixture providing an isolated test database.

    Creates an in-memory database for each test.
    This ensures tests don't interfere with each other.

    Yields:
        sqlite3.Connection: Test database connection

    Usage:
        def test_database_operation(test_database):
            cursor = test_database.cursor()
            cursor.execute("INSERT INTO projects ...")
            test_database.commit()
    """
    # Create in-memory database
    conn = sqlite3.connect(':memory:')
    conn.row_factory = sqlite3.Row

    # Create schema
    conn.executescript('''
        CREATE TABLE projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            settings TEXT DEFAULT '{}',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE kanban_tasks (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            column TEXT NOT NULL DEFAULT 'backlog',
            priority INTEGER NOT NULL DEFAULT 3,
            pipeline_status TEXT NOT NULL DEFAULT 'idle',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE plans (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            tasks TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
    ''')

    yield conn

    # Cleanup
    conn.close()


@pytest.fixture
def test_database_file() -> str:
    """
    Fixture providing a file-based test database.

    Some tests require a file-based database for testing file I/O.

    Yields:
        str: Path to test database file

    Usage:
        def test_with_file_db(test_database_file):
            conn = sqlite3.connect(test_database_file)
            # ... perform tests
    """
    # Create temporary file
    fd, path = tempfile.mkstemp(suffix='.db')
    os.close(fd)

    yield path

    # Cleanup
    try:
        os.unlink(path)
    except OSError:
        pass


@pytest.fixture
def sample_project_data() -> Dict[str, Any]:
    """
    Fixture providing sample project data.

    Returns:
        Dict containing sample project data

    Usage:
        def test_create_project(sample_project_data):
            project = Project.create(sample_project_data)
            assert project.name == sample_project_data['name']
    """
    return {
        'id': 'test-project-123',
        'name': 'Test Project',
        'description': 'A test project for integration testing',
        'settings': {'key': 'value'},
    }


@pytest.fixture
def sample_task_data() -> Dict[str, Any]:
    """
    Fixture providing sample task data.

    Returns:
        Dict containing sample kanban task data

    Usage:
        def test_create_task(sample_task_data):
            task = KanbanTask.create(sample_task_data)
            assert task.title == sample_task_data['title']
    """
    return {
        'id': 'test-task-456',
        'project_id': 'test-project-123',
        'title': 'Test Task',
        'description': 'A test task',
        'column': 'backlog',
        'priority': 3,
        'pipeline_status': 'idle',
    }


@pytest.fixture
def populated_database(test_database: sqlite3.Connection) -> sqlite3.Connection:
    """
    Fixture providing a database pre-populated with test data.

    Args:
        test_database: Base test database fixture

    Returns:
        sqlite3.Connection: Database with test data

    Usage:
        def test_query_existing_data(populated_database):
            cursor = populated_database.cursor()
            projects = cursor.execute("SELECT * FROM projects").fetchall()
            assert len(projects) > 0
    """
    # Insert test data
    test_database.execute(
        'INSERT INTO projects (id, name, description) VALUES (?, ?, ?)',
        ('test-project-123', 'Test Project', 'A test project')
    )

    test_database.execute(
        '''INSERT INTO kanban_tasks
           (id, project_id, title, description, column, priority, pipeline_status)
           VALUES (?, ?, ?, ?, ?, ?, ?)''',
        ('test-task-456', 'test-project-123', 'Test Task', 'A test task',
         'backlog', 3, 'idle')
    )

    test_database.commit()

    return test_database


@pytest.fixture
def api_client():
    """
    Fixture providing a test API client.

    Use this for testing API endpoints.

    Yields:
        Test client instance

    Usage:
        def test_api_endpoint(api_client):
            response = api_client.get('/api/projects')
            assert response.status_code == 200
    """
    # Import your test client
    # from tests.helpers.test_client import TestClient
    # client = TestClient()
    # yield client
    pass


@pytest.fixture
def authenticated_client(api_client):
    """
    Fixture providing an authenticated API client.

    Use this for testing authenticated endpoints.

    Args:
        api_client: Base API client fixture

    Yields:
        Authenticated test client instance

    Usage:
        def test_authenticated_endpoint(authenticated_client):
            response = authenticated_client.get('/api/user/profile')
            assert response.status_code == 200
    """
    # Set up authentication
    # api_client.set_auth_token('test-token')
    # yield api_client
    pass


# =============================================================================
# INTEGRATION TEST CLASS
# Test interactions between components
# =============================================================================

class TestDatabaseIntegration:
    """
    Test database integration with service layer.

    These tests verify that database operations work correctly
    through the service layer.
    """

    def test_create_and_retrieve_project(self, test_database: sqlite3.Connection):
        """
        Test creating a project and retrieving it from database.

        This tests the full round-trip: create → save → retrieve → verify

        Args:
            test_database: Test database fixture
        """
        # Arrange
        project_id = 'test-project-123'
        project_data = {
            'id': project_id,
            'name': 'Test Project',
            'description': 'A test project',
        }

        # Act - Create project
        test_database.execute(
            'INSERT INTO projects (id, name, description) VALUES (?, ?, ?)',
            (project_data['id'], project_data['name'], project_data['description'])
        )
        test_database.commit()

        # Act - Retrieve project
        cursor = test_database.cursor()
        result = cursor.execute(
            'SELECT * FROM projects WHERE id = ?',
            (project_id,)
        ).fetchone()

        # Assert
        assert result is not None
        assert result['id'] == project_id
        assert result['name'] == 'Test Project'
        assert result['description'] == 'A test project'

    def test_create_task_with_foreign_key(self, test_database: sqlite3.Connection):
        """
        Test creating a task with a foreign key to a project.

        This tests referential integrity.

        Args:
            test_database: Test database fixture
        """
        # Arrange - Create project first
        project_id = 'test-project-123'
        test_database.execute(
            'INSERT INTO projects (id, name, description) VALUES (?, ?, ?)',
            (project_id, 'Test Project', 'A test project')
        )

        # Act - Create task with foreign key
        task_id = 'test-task-456'
        test_database.execute(
            '''INSERT INTO kanban_tasks
               (id, project_id, title, description, column, priority, pipeline_status)
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (task_id, project_id, 'Test Task', 'A test task', 'backlog', 3, 'idle')
        )
        test_database.commit()

        # Assert - Verify task was created
        cursor = test_database.cursor()
        task = cursor.execute(
            'SELECT * FROM kanban_tasks WHERE id = ?',
            (task_id,)
        ).fetchone()

        assert task is not None
        assert task['project_id'] == project_id
        assert task['title'] == 'Test Task'

    def test_cascade_delete(self, test_database: sqlite3.Connection):
        """
        Test that deleting a project cascades to its tasks.

        This tests foreign key cascade behavior.

        Args:
            test_database: Test database fixture
        """
        # Arrange - Create project and tasks
        project_id = 'test-project-123'
        test_database.execute(
            'INSERT INTO projects (id, name, description) VALUES (?, ?, ?)',
            (project_id, 'Test Project', 'A test project')
        )

        test_database.execute(
            '''INSERT INTO kanban_tasks
               (id, project_id, title, description, column, priority, pipeline_status)
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            ('task-1', project_id, 'Task 1', 'Description', 'backlog', 3, 'idle')
        )

        test_database.commit()

        # Act - Delete project
        test_database.execute('DELETE FROM projects WHERE id = ?', (project_id,))
        test_database.commit()

        # Assert - Verify tasks were deleted (cascade)
        cursor = test_database.cursor()
        tasks = cursor.execute(
            'SELECT * FROM kanban_tasks WHERE project_id = ?',
            (project_id,)
        ).fetchall()

        assert len(tasks) == 0

    def test_transaction_rollback(self, test_database: sqlite3.Connection):
        """
        Test that transaction rollback works correctly.

        This tests transaction handling and error recovery.

        Args:
            test_database: Test database fixture
        """
        # Arrange - Create initial data
        test_database.execute(
            'INSERT INTO projects (id, name, description) VALUES (?, ?, ?)',
            ('project-1', 'Project 1', 'Description 1')
        )
        test_database.commit()

        # Get initial count
        cursor = test_database.cursor()
        initial_count = cursor.execute('SELECT COUNT(*) FROM projects').fetchone()[0]

        try:
            # Act - Start transaction and insert data
            with test_database:
                test_database.execute(
                    'INSERT INTO projects (id, name, description) VALUES (?, ?, ?)',
                    ('project-2', 'Project 2', 'Description 2')
                )
                # Simulate error
                raise ValueError("Simulated error")

        except ValueError:
            pass

        # Assert - Verify rollback
        final_count = cursor.execute('SELECT COUNT(*) FROM projects').fetchone()[0]
        assert final_count == initial_count


class TestServiceIntegration:
    """
    Test service layer integration with database and API.

    These tests verify that services correctly coordinate between layers.
    """

    def test_service_creates_project_in_database(
        self,
        test_database: sqlite3.Connection,
        sample_project_data: Dict[str, Any]
    ):
        """
        Test that service creates project in database.

        Args:
            test_database: Test database fixture
            sample_project_data: Sample project data fixture
        """
        # Arrange
        # service = ProjectService(test_database)

        # Act
        # project = service.create(sample_project_data)

        # Assert
        # assert project.id == sample_project_data['id']
        # assert project.name == sample_project_data['name']

        # Verify in database
        # cursor = test_database.cursor()
        # result = cursor.execute('SELECT * FROM projects WHERE id = ?',
        #                        (project.id,)).fetchone()
        # assert result is not None
        pass

    def test_service_handles_database_errors(self, test_database: sqlite3.Connection):
        """
        Test that service handles database errors gracefully.

        Args:
            test_database: Test database fixture
        """
        # Arrange
        # service = ProjectService(test_database)
        invalid_data = {'id': None, 'name': ''}  # Invalid data

        # Act & Assert
        # with pytest.raises(ValueError):
        #     service.create(invalid_data)
        pass


class TestAPIIntegration:
    """
    Test API endpoint integration with services.

    These tests verify that API endpoints correctly call services
    and return appropriate responses.
    """

    def test_api_endpoint_creates_resource(
        self,
        api_client,
        sample_project_data: Dict[str, Any]
    ):
        """
        Test that API endpoint creates resource via service.

        Args:
            api_client: Test API client fixture
            sample_project_data: Sample project data fixture
        """
        # Arrange
        endpoint = '/api/projects'
        data = sample_project_data

        # Act
        # response = api_client.post(endpoint, json=data)

        # Assert
        # assert response.status_code == 201
        # assert response.json()['id'] == sample_project_data['id']
        # assert response.json()['name'] == sample_project_data['name']
        pass

    def test_api_endpoint_returns_validation_errors(self, api_client):
        """
        Test that API endpoint returns validation errors for invalid data.

        Args:
            api_client: Test API client fixture
        """
        # Arrange
        endpoint = '/api/projects'
        invalid_data = {'name': ''}  # Missing required fields

        # Act
        # response = api_client.post(endpoint, json=invalid_data)

        # Assert
        # assert response.status_code == 400
        # assert 'errors' in response.json()
        pass

    def test_api_endpoint_handles_not_found(self, api_client):
        """
        Test that API endpoint returns 404 for non-existent resources.

        Args:
            api_client: Test API client fixture
        """
        # Arrange
        non_existent_id = 'non-existent-123'
        endpoint = f'/api/projects/{non_existent_id}'

        # Act
        # response = api_client.get(endpoint)

        # Assert
        # assert response.status_code == 404
        pass


class TestWorkflowIntegration:
    """
    Test multi-step workflows across components.

    These tests verify complete workflows that span multiple components.
    """

    def test_create_project_and_add_task(
        self,
        test_database: sqlite3.Connection,
        sample_project_data: Dict[str, Any],
        sample_task_data: Dict[str, Any]
    ):
        """
        Test workflow: Create project, add task, verify both exist.

        This tests a complete workflow across multiple database operations.

        Args:
            test_database: Test database fixture
            sample_project_data: Sample project data fixture
            sample_task_data: Sample task data fixture
        """
        # Arrange - Create project
        test_database.execute(
            'INSERT INTO projects (id, name, description) VALUES (?, ?, ?)',
            (sample_project_data['id'], sample_project_data['name'],
             sample_project_data['description'])
        )

        # Act - Add task to project
        test_database.execute(
            '''INSERT INTO kanban_tasks
               (id, project_id, title, description, column, priority, pipeline_status)
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (sample_task_data['id'], sample_task_data['project_id'],
             sample_task_data['title'], sample_task_data['description'],
             sample_task_data['column'], sample_task_data['priority'],
             sample_task_data['pipeline_status'])
        )
        test_database.commit()

        # Assert - Verify both exist
        cursor = test_database.cursor()

        project = cursor.execute(
            'SELECT * FROM projects WHERE id = ?',
            (sample_project_data['id'],)
        ).fetchone()
        assert project is not None

        task = cursor.execute(
            'SELECT * FROM kanban_tasks WHERE id = ?',
            (sample_task_data['id'],)
        ).fetchone()
        assert task is not None
        assert task['project_id'] == sample_project_data['id']

    def test_update_task_status_and_verify(
        self,
        populated_database: sqlite3.Connection
    ):
        """
        Test workflow: Update task status, query for tasks with new status.

        This tests updates and queries working together.

        Args:
            populated_database: Database with test data fixture
        """
        # Arrange - Get initial task
        cursor = populated_database.cursor()
        task = cursor.execute(
            'SELECT * FROM kanban_tasks WHERE id = ?',
            ('test-task-456',)
        ).fetchone()
        assert task['pipeline_status'] == 'idle'

        # Act - Update task status
        populated_database.execute(
            'UPDATE kanban_tasks SET pipeline_status = ? WHERE id = ?',
            ('running', 'test-task-456')
        )
        populated_database.commit()

        # Assert - Verify update
        updated_task = cursor.execute(
            'SELECT * FROM kanban_tasks WHERE id = ?',
            ('test-task-456',)
        ).fetchone()
        assert updated_task['pipeline_status'] == 'running'

        # Assert - Verify query for running tasks
        running_tasks = cursor.execute(
            "SELECT * FROM kanban_tasks WHERE pipeline_status = 'running'"
        ).fetchall()
        assert len(running_tasks) == 1


# =============================================================================
# STANDALONE INTEGRATION TESTS
# Integration tests that don't need a class structure
# =============================================================================

def test_database_connection_and_query(test_database: sqlite3.Connection):
    """
    Test basic database connection and query.

    Args:
        test_database: Test database fixture
    """
    # Arrange
    test_database.execute(
        'INSERT INTO projects (id, name, description) VALUES (?, ?, ?)',
        ('test-1', 'Test', 'Description')
    )
    test_database.commit()

    # Act
    cursor = test_database.cursor()
    result = cursor.execute('SELECT * FROM projects').fetchall()

    # Assert
    assert len(result) == 1
    assert result[0]['name'] == 'Test'


# =============================================================================
# RUNNING THE TESTS
# =============================================================================
#
# Run all integration tests:
#   pytest tests/integration/
#
# Run with verbose output:
#   pytest tests/integration/ -v
#
# Run specific test class:
#   pytest tests/integration/test_integration.py::TestDatabaseIntegration
#
# Run specific test:
#   pytest tests/integration/test_integration.py::TestDatabaseIntegration::test_create_and_retrieve_project
#
# Run with database logging (for debugging):
#   pytest tests/integration/ --log-cli-level=DEBUG
#
# Run and stop on first failure:
#   pytest tests/integration/ -x
#
# Run with coverage:
#   pytest tests/integration/ --cov=client --cov-report=html
# =============================================================================
