"""
Pytest configuration and fixtures for client tests.

This module provides shared fixtures, test data factories, and configuration
for all Python tests in the client directory.
"""

import sys
from pathlib import Path
from typing import Generator, Optional
from unittest.mock import Mock, patch

import pytest
from httpx import Response

# Add parent directories to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from orchestrator.daemon_client import DaemonClient
from tests.fixtures import (
    generate_id,
    generate_token,
    create_project_data,
    create_plan_data,
    create_kanban_task_data,
    create_agent_data,
    create_approval_data,
    create_log_entry_data,
    api_response,
)


# ============================================================================
# Mock HTTP Client Fixtures
# ============================================================================

@pytest.fixture
def mock_http_response():
    """
    Fixture that creates a mock HTTP response.

    Returns:
        Mock object configured as httpx Response
    """
    return Mock(spec=Response)


@pytest.fixture
def mock_http_client():
    """
    Fixture that provides a mock HTTP client for testing.

    Yields:
        Tuple of (mock_httpx_class, mock_httpx_instance)
    """
    with patch("orchestrator.daemon_client.httpx.Client") as mock_httpx:
        mock_instance = Mock()
        mock_httpx.return_value = mock_instance
        yield mock_httpx, mock_instance


@pytest.fixture
def daemon_client(mock_http_client):
    """
    Fixture that provides a DaemonClient with mocked HTTP client.

    Args:
        mock_http_client: Injected mock HTTP client fixture

    Yields:
        DaemonClient instance with mocked HTTP client
    """
    mock_httpx, mock_instance = mock_http_client
    client = DaemonClient("http://localhost:3001", "test-token")
    client._client = mock_instance
    yield client


# ============================================================================
# Test Data Fixtures
# ============================================================================

@pytest.fixture
def test_project():
    """Fixture providing a test project dict."""
    return create_project_data()


@pytest.fixture
def test_plan():
    """Fixture providing a test plan dict."""
    return create_plan_data()


@pytest.fixture
def test_kanban_task(test_project):
    """
    Fixture providing a test kanban task dict.

    Args:
        test_project: Injected test project fixture

    Returns:
        Test kanban task dict
    """
    return create_kanban_task_data(test_project["id"])


@pytest.fixture
def test_agent():
    """Fixture providing a test agent dict."""
    return create_agent_data()


@pytest.fixture
def test_approval():
    """Fixture providing a test approval request dict."""
    return create_approval_data()


@pytest.fixture
def test_log_entry():
    """Fixture providing a test log entry dict."""
    plan_id = generate_id("plan")
    return create_log_entry_data(plan_id)


# ============================================================================
# Helper Function Fixtures
# ============================================================================

@pytest.fixture
def mock_response_factory():
    """
    Factory fixture for creating mock API responses.

    Yields:
        Function that creates mock response objects
    """

    def _create_response(data: any = None, error: Optional[str] = None, status_code: int = 200):
        """
        Create a mock API response.

        Args:
            data: Response data
            error: Error message if any
            status_code: HTTP status code

        Returns:
            Mock response object
        """
        mock_resp = Mock(spec=Response)
        mock_resp.status_code = status_code
        mock_resp.json.return_value = api_response(data, error)
        return mock_resp

    return _create_response


@pytest.fixture
def mock_pending_plans_response(mock_response_factory):
    """
    Fixture providing a mock response for pending plans.

    Args:
        mock_response_factory: Injected response factory

    Returns:
        Mock response with pending plans data
    """
    plans = [create_plan_data({"id": generate_id("plan"), "name": f"Plan {i}"}) for i in range(3)]
    return mock_response_factory(plans)


# ============================================================================
# Test Environment Configuration
# ============================================================================

@pytest.fixture(scope="session")
def test_server_url():
    """Fixture providing test server URL."""
    return "http://localhost:3001"


@pytest.fixture(scope="session")
def test_auth_token():
    """Fixture providing test authentication token."""
    return "test-token-1234567890"


# ============================================================================
# Test Markers Configuration
# ============================================================================

def pytest_configure(config):
    """
    Configure pytest with custom markers for test categorization.

    Args:
        config: Pytest config object
    """
    markers = [
        "unit: Unit tests (fast, isolated)",
        "integration: Integration tests (require external services)",
        "slow: Slow running tests",
        "http: Tests making HTTP requests",
        "database: Tests requiring database access",
        "daemon: Tests for daemon client functionality",
        "approval: Tests for approval workflow",
    ]

    for marker in markers:
        config.addinivalue_line("markers", marker)


# ============================================================================
# Performance Optimization
# ============================================================================

@pytest.fixture(autouse=True)
def time_tracking(request):
    """
    Auto-use fixture to track test execution time.

    Marks slow tests automatically if they take longer than 1 second.

    Args:
        request: Pytest request object
    """
    import time

    start_time = time.time()

    yield

    duration = time.time() - start_time

    # Mark slow tests
    if duration > 1.0:
        # Add slow marker if not already present
        if "slow" not in request.node.keywords:
            request.node.add_marker(pytest.mark.slow)


# ============================================================================
# Cleanup Helpers
# ============================================================================

@pytest.fixture
def cleanup_test_files():
    """
    Fixture that provides a cleanup context for test files.

    Yields:
        List to register file paths for cleanup
    """
    files_to_cleanup = []

    yield files_to_cleanup

    # Cleanup registered files
    for file_path in files_to_cleanup:
        path = Path(file_path)
        if path.exists():
            if path.is_dir():
                import shutil
                shutil.rmtree(path)
            else:
                path.unlink()


# ============================================================================
# Assertion Helpers
# ============================================================================

@pytest.fixture
def assert_valid_api_response():
    """
    Fixture providing assertion helper for API responses.

    Yields:
        Function to validate API response structure
    """

    def _assert_valid(response: dict, has_data: bool = True):
        """
        Assert that response has valid API envelope structure.

        Args:
            response: Response dict to validate
            has_data: Whether response should have data field
        """
        assert "error" in response, "Response should have 'error' field"
        if has_data:
            assert "data" in response, "Response should have 'data' field"
        else:
            assert response.get("data") is None, "Response should not have 'data' field"

    return _assert_valid


@pytest.fixture
def assert_plan_response(assert_valid_api_response):
    """
    Fixture providing assertion helper for plan responses.

    Args:
        assert_valid_api_response: Injected API response validator

    Yields:
        Function to validate plan response structure
    """

    def _assert_plan(response: dict):
        """
        Assert that response has valid plan structure.

        Args:
            response: Response dict to validate
        """
        assert_valid_api_response(response)
        if response.get("data"):
            plan = response["data"]
            assert "id" in plan, "Plan should have 'id'"
            assert "name" in plan, "Plan should have 'name'"
            assert "tasks" in plan, "Plan should have 'tasks'"
            assert "status" in plan, "Plan should have 'status'"

    return _assert_plan
