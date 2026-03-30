"""
Tests for DaemonClient HTTP client.

Tests use mocked HTTP responses to verify:
- API endpoint calls
- Request formatting
- Response parsing
- Error handling
"""

from unittest.mock import Mock, patch

import pytest

from orchestrator.daemon_client import DaemonClient, PlanResponse


@pytest.fixture
def mock_client():
    """Create a DaemonClient with mocked HTTP client."""
    with patch("orchestrator.daemon_client.httpx.Client") as mock_httpx:
        mock_httpx_instance = Mock()
        mock_httpx.return_value = mock_httpx_instance
        client = DaemonClient("http://localhost:3001", "test-token")
        client._client = mock_httpx_instance
        yield client, mock_httpx_instance


class TestDaemonClientInit:
    """Test DaemonClient initialization."""

    def test_init_basic(self):
        """Test basic initialization."""
        with patch("orchestrator.daemon_client.httpx.Client"):
            client = DaemonClient("http://localhost:3001", "test-token")

            assert client.server_url == "http://localhost:3001"
            assert client.token == "test-token"
            assert client.client_id  # Should be hostname

    def test_init_trailing_slash(self):
        """Test that trailing slash is removed from server URL."""
        with patch("orchestrator.daemon_client.httpx.Client"):
            client = DaemonClient("http://localhost:3001/", "test-token")
            assert client.server_url == "http://localhost:3001"

    def test_close(self):
        """Test closing the HTTP client."""
        with patch("orchestrator.daemon_client.httpx.Client") as mock_httpx:
            mock_instance = Mock()
            mock_httpx.return_value = mock_instance

            client = DaemonClient("http://localhost:3001", "test-token")
            client.close()

            mock_instance.close.assert_called_once()


class TestGetPendingPlans:
    """Test get_pending_plans method."""

    def test_get_pending_plans_success(self, mock_client):
        """Test successful retrieval of pending plans."""
        client, mock_http = mock_client

        # Mock API response with envelope
        mock_response = Mock()
        mock_response.json.return_value = {
            "data": [
                {
                    "id": "plan-1",
                    "name": "Test Plan",
                    "tasks": [],
                    "status": "pending",
                }
            ],
            "error": None,
        }
        mock_http.get.return_value = mock_response

        result = client.get_pending_plans()

        assert result.error is None
        assert len(result.data) == 1
        assert result.data[0]["id"] == "plan-1"
        mock_http.get.assert_called_once_with("/plans/pending")

    def test_get_pending_plans_empty(self, mock_client):
        """Test when no pending plans exist."""
        client, mock_http = mock_client

        mock_response = Mock()
        mock_response.json.return_value = {
            "data": [],
            "error": None,
        }
        mock_http.get.return_value = mock_response

        result = client.get_pending_plans()

        assert result.error is None
        assert result.data == []

    def test_get_pending_plans_http_error(self, mock_client):
        """Test handling of HTTP errors."""
        client, mock_http = mock_client

        import httpx
        mock_http.get.side_effect = httpx.RequestError("Connection failed")

        result = client.get_pending_plans()

        assert result.data is None
        assert "HTTP error" in result.error

    def test_get_pending_plans_json_error(self, mock_client):
        """Test handling of JSON parsing errors."""
        client, mock_http = mock_client

        mock_response = Mock()
        mock_response.json.side_effect = ValueError("Invalid JSON")
        mock_http.get.return_value = mock_response

        result = client.get_pending_plans()

        assert result.data is None
        assert "Failed to parse response" in result.error


class TestStartPlan:
    """Test start_plan method."""

    def test_start_plan_success(self, mock_client):
        """Test successful plan start."""
        client, mock_http = mock_client

        mock_response = Mock()
        mock_response.json.return_value = {
            "data": {
                "id": "plan-1",
                "status": "running",
                "client_id": "test-host",
            },
            "error": None,
        }
        mock_http.post.return_value = mock_response

        result = client.start_plan("plan-1")

        assert result.error is None
        assert result.data["status"] == "running"
        mock_http.post.assert_called_once_with(
            "/plans/plan-1/start",
            json={"client_id": client.client_id},
        )

    def test_start_plan_with_custom_client_id(self):
        """Test start_plan uses hostname as client_id."""
        with patch("orchestrator.daemon_client.socket.gethostname") as mock_hostname:
            mock_hostname.return_value = "custom-host"

            with patch("orchestrator.daemon_client.httpx.Client") as mock_httpx:
                mock_http = Mock()
                mock_httpx.return_value = mock_http

                mock_response = Mock()
                mock_response.json.return_value = {"data": {}, "error": None}
                mock_http.post.return_value = mock_response

                client = DaemonClient("http://localhost:3001", "test-token")
                client.start_plan("plan-1")

                # Verify client_id is included in request
                call_args = mock_http.post.call_args
                assert call_args[1]["json"]["client_id"] == "custom-host"


class TestSendLogs:
    """Test send_logs method."""

    def test_send_logs_success(self, mock_client):
        """Test successful log submission."""
        client, mock_http = mock_client

        logs = [
            {"task_id": "task-1", "level": "info", "message": "Test log"},
            {"task_id": "task-1", "level": "error", "message": "Test error"},
        ]

        mock_response = Mock()
        mock_response.json.return_value = {
            "data": {"success": True},
            "error": None,
        }
        mock_http.post.return_value = mock_response

        result = client.send_logs("plan-1", logs)

        assert result.error is None
        assert result.data["success"] is True
        mock_http.post.assert_called_once_with(
            "/plans/plan-1/logs",
            json=logs,
        )

    def test_send_logs_empty(self, mock_client):
        """Test sending empty log list - should return early without HTTP call."""
        client, mock_http = mock_client

        # Empty logs should return early without making HTTP request
        result = client.send_logs("plan-1", [])

        assert result.error is None
        assert result.data is True  # Should return success without HTTP call
        mock_http.post.assert_not_called()  # No HTTP request should be made


class TestCompletePlan:
    """Test complete_plan method."""

    def test_complete_plan_success(self, mock_client):
        """Test successful plan completion."""
        client, mock_http = mock_client

        mock_response = Mock()
        mock_response.json.return_value = {
            "data": {
                "id": "plan-1",
                "status": "success",
            },
            "error": None,
        }
        mock_http.post.return_value = mock_response

        result = client.complete_plan("plan-1", "success", "Plan completed")

        assert result.error is None
        assert result.data["status"] == "success"
        # Verify the call includes daemon_completed_at field
        call_args = mock_http.post.call_args
        assert call_args[0][0] == "/plans/plan-1/complete"
        assert "status" in call_args[1]["json"]
        assert "result" in call_args[1]["json"]
        assert "daemon_completed_at" in call_args[1]["json"]
        assert call_args[1]["json"]["status"] == "success"
        assert call_args[1]["json"]["result"] == "Plan completed"

    def test_complete_plan_failed(self, mock_client):
        """Test marking plan as failed."""
        client, mock_http = mock_client

        mock_response = Mock()
        mock_response.json.return_value = {
            "data": {
                "id": "plan-1",
                "status": "failed",
            },
            "error": None,
        }
        mock_http.post.return_value = mock_response

        result = client.complete_plan("plan-1", "failed", "Task failed")

        assert result.error is None
        assert result.data["status"] == "failed"

    def test_complete_plan_without_result(self, mock_client):
        """Test completion without optional result field."""
        client, mock_http = mock_client

        mock_response = Mock()
        mock_response.json.return_value = {"data": {}, "error": None}
        mock_http.post.return_value = mock_response

        result = client.complete_plan("plan-1", "success")

        assert result.error is None
        # Verify only status is sent
        call_args = mock_http.post.call_args
        assert "result" not in call_args[1]["json"]
        assert call_args[1]["json"]["status"] == "success"


class TestResponseHandling:
    """Test response envelope handling."""

    def test_handle_response_with_error(self, mock_client):
        """Test handling of API error responses."""
        client, _ = mock_client

        mock_response = Mock()
        mock_response.json.return_value = {
            "data": None,
            "error": "Plan not found",
        }
        mock_response.status_code = 404

        result = client._handle_response(mock_response)

        assert result.data is None
        assert result.error == "Plan not found"

    def test_handle_response_non_envelope(self, mock_client):
        """Test handling of non-envelope response (fallback)."""
        client, _ = mock_client

        mock_response = Mock()
        # Non-envelope response - the whole response is treated as data
        # Since it's a dict without "data" key, .get() returns None
        mock_response.json.return_value = {"status": "ok"}

        result = client._handle_response(mock_response)

        # The implementation uses .get("data"), so dict without "data" key returns None
        assert result.data is None
        assert result.error is None

    def test_handle_response_parse_error(self, mock_client):
        """Test handling of JSON parse errors."""
        client, _ = mock_client

        mock_response = Mock()
        mock_response.json.side_effect = ValueError("Invalid JSON")

        result = client._handle_response(mock_response)

        assert result.data is None
        assert "Failed to parse response" in result.error


class TestChatSessionMethods:
    """Test chat session methods."""

    def test_get_pending_sessions_success(self, mock_client):
        """Test successful retrieval of pending sessions."""
        client, mock_http = mock_client

        # Mock API response with envelope
        mock_response = Mock()
        mock_response.json.return_value = {
            "data": [
                {
                    "id": "session-1",
                    "name": "Test Session",
                    "workspace_path": "/path/to/workspace",
                    "status": "waiting",
                    "last_user_message": "Hello",
                }
            ],
            "error": None,
        }
        mock_http.get.return_value = mock_response

        result = client.get_pending_sessions()

        assert result.error is None
        assert len(result.data) == 1
        assert result.data[0]["id"] == "session-1"
        mock_http.get.assert_called_once_with("/sessions/pending")

    def test_save_sdk_session_id_success(self, mock_client):
        """Test successful saving of SDK session ID."""
        client, mock_http = mock_client

        mock_response = Mock()
        mock_response.json.return_value = {
            "data": {
                "id": "session-1",
                "sdk_session_id": "sdk-session-123",
            },
            "error": None,
        }
        mock_http.post.return_value = mock_response

        result = client.save_sdk_session_id("session-1", "sdk-session-123")

        assert result.error is None
        assert result.data["sdk_session_id"] == "sdk-session-123"
        mock_http.post.assert_called_once_with(
            "/sessions/session-1/sdk-session",
            json={"sdk_session_id": "sdk-session-123"},
        )

    def test_save_assistant_message_success(self, mock_client):
        """Test successful saving of assistant message."""
        client, mock_http = mock_client

        mock_response = Mock()
        mock_response.json.return_value = {
            "data": {
                "id": "session-1",
                "status": "idle",
            },
            "error": None,
        }
        mock_http.post.return_value = mock_response

        result = client.save_assistant_message(
            "session-1",
            "Hello, how can I help?",
            None,
        )

        assert result.error is None
        mock_http.post.assert_called_once_with(
            "/sessions/session-1/assistant-message",
            json={"content": "Hello, how can I help?"},
        )

    def test_save_assistant_message_with_structured_output(self, mock_client):
        """Test saving assistant message with structured output."""
        client, mock_http = mock_client

        mock_response = Mock()
        mock_response.json.return_value = {
            "data": {
                "id": "session-1",
                "status": "idle",
            },
            "error": None,
        }
        mock_http.post.return_value = mock_response

        structured_output = {
            "type": "plan",
            "content": {"tasks": ["task1", "task2"]},
        }

        result = client.save_assistant_message(
            "session-1",
            "Here is a plan for you",
            structured_output,
        )

        assert result.error is None
        call_args = mock_http.post.call_args
        assert call_args[1]["json"]["content"] == "Here is a plan for you"
        assert call_args[1]["json"]["structured_output"] == structured_output
