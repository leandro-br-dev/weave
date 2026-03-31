"""
Shared pytest fixtures for root-level tests.

This module provides common fixtures and configuration for all Python tests.
It automatically loads test environment configuration from tests/.env.test.
"""

import os
import sys
import tempfile
from pathlib import Path
from typing import Generator, Optional

import pytest


# Add client directory to Python path for all tests
sys.path.insert(0, str(Path(__file__).parent.parent / 'client'))


# Load test environment variables
def load_test_env():
    """Load test environment variables from .env.test file."""
    env_file = Path(__file__).parent / '.env.test'
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ.setdefault(key.strip(), value.strip())


load_test_env()


@pytest.fixture(scope="session")
def test_env() -> dict:
    """Fixture providing access to test environment variables."""
    return {
        'test_db_path': os.getenv('TEST_DB_PATH', '/tmp/weave-test.db'),
        'test_api_url': os.getenv('TEST_API_URL', 'http://localhost:3000'),
        'test_api_token': os.getenv('TEST_API_TOKEN', 'test-token-for-testing-only'),
        'test_projects_dir': os.getenv('TEST_PROJECTS_DIR', '/tmp/test-projects'),
        'test_workspace_dir': os.getenv('TEST_WORKSPACE_DIR', '/tmp/test-workspaces'),
        'test_cleanup_enabled': os.getenv('TEST_CLEANUP_ENABLED', 'true').lower() == 'true',
        'test_timeout': int(os.getenv('TEST_TIMEOUT', '30')),
    }


@pytest.fixture(scope="session")
def test_temp_dir() -> Generator[Path, None, None]:
    """Fixture providing a temporary directory for test files."""
    temp_dir = Path(tempfile.mkdtemp(prefix='weave-test-'))
    yield temp_dir
    # Cleanup after all tests
    if temp_dir.exists():
        import shutil
        shutil.rmtree(temp_dir)


@pytest.fixture(scope="function")
def test_db_path(test_env: dict) -> Generator[str, None, None]:
    """
    Fixture providing a test database path.
    Creates a fresh database for each test function.
    """
    db_path = test_env['test_db_path']

    yield db_path

    # Cleanup after test
    if test_env['test_cleanup_enabled'] and Path(db_path).exists():
        Path(db_path).unlink()


@pytest.fixture(scope="function")
def test_projects_dir(test_env: dict, test_temp_dir: Path) -> Generator[Path, None, None]:
    """
    Fixture providing a temporary directory for test projects.
    """
    projects_dir = test_temp_dir / 'projects'
    projects_dir.mkdir(exist_ok=True)
    yield projects_dir


@pytest.fixture(scope="function")
def test_workspace_dir(test_env: dict, test_temp_dir: Path) -> Generator[Path, None, None]:
    """
    Fixture providing a temporary directory for test workspaces.
    """
    workspace_dir = test_temp_dir / 'workspaces'
    workspace_dir.mkdir(exist_ok=True)
    yield workspace_dir


@pytest.fixture
def sample_project():
    """Fixture providing a sample project dict."""
    return {
        'id': 'test-project-123',
        'name': 'Test Project',
        'description': 'A test project for testing',
    }


@pytest.fixture
def sample_kanban_task():
    """Fixture providing a sample kanban task dict."""
    return {
        'id': 'task-1',
        'project_id': 'test-project-123',
        'title': 'Test Task',
        'description': 'A test task',
        'column': 'backlog',
        'priority': 3,
        'pipeline_status': 'idle',
    }


@pytest.fixture
def sample_plan():
    """Fixture providing a sample plan dict."""
    return {
        'id': 'plan-1',
        'project_id': 'test-project-123',
        'name': 'Test Plan',
        'tasks': [
            {
                'id': 'task-1',
                'name': 'First task',
                'prompt': 'Do something',
            }
        ],
        'status': 'pending',
    }


@pytest.fixture
def mock_agent():
    """Fixture providing a mock agent configuration."""
    return {
        'id': 'test-agent-1',
        'name': 'Test Agent',
        'type': 'claude',
        'model': 'claude-3-5-sonnet',
        'status': 'idle',
        'capabilities': ['code', 'analysis', 'planning'],
    }


@pytest.fixture
def api_headers(test_env: dict) -> dict:
    """Fixture providing common API headers for testing."""
    return {
        'Authorization': f"Bearer {test_env['test_api_token']}",
        'Content-Type': 'application/json',
    }


def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line("markers", "unit: Unit tests")
    config.addinivalue_line("markers", "integration: Integration tests")
    config.addinivalue_line("markers", "e2e: End-to-end tests")
    config.addinivalue_line("markers", "slow: Slow running tests")
    config.addinivalue_line("markers", "database: Tests requiring database")
    config.addinivalue_line("markers", "api: Tests requiring API server")
    config.addinivalue_line("markers", "agents: Tests requiring agent services")


@pytest.fixture(autouse=True)
def reset_environment():
    """
    Auto-use fixture to reset environment variables before each test.
    Ensures tests don't affect each other's environment.
    """
    # Store original environment
    original_env = os.environ.copy()

    # Reload test environment
    load_test_env()

    yield

    # Restore original environment
    os.environ.clear()
    os.environ.update(original_env)
