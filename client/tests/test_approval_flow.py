"""
Tests for approval flow in daemon mode.

Tests the DaemonClient approval methods and deny rule matching logic.

Test Categories:
    - daemon: Tests for daemon client functionality
    - approval: Tests for approval workflow
"""

import json
from pathlib import Path
from unittest.mock import Mock, patch

import pytest
from httpx import Response

from orchestrator.daemon_client import DaemonClient, PlanResponse
from orchestrator.runner import _check_deny_rules, _load_deny_rules
from tests.fixtures import (
    generate_id,
    generate_token,
    create_plan_data,
    create_approval_data,
    api_response,
)


class TestDaemonClientApproval:
    """
    Test DaemonClient approval methods.

    Tests the approval request workflow including:
    - Requesting approval for operations
    - Waiting for approval decisions
    - Handling timeouts and errors
    """

    @pytest.fixture(autouse=True)
    def setup(self, daemon_client):
        """
        Set up test fixtures for each test.

        Args:
            daemon_client: Injected daemon client fixture
        """
        self.client = daemon_client
        self.plan_id = generate_id("plan")
        self.task_id = generate_id("task")

    @pytest.mark.daemon
    @pytest.mark.approval
    def test_request_approval_success(self, mock_response_factory):
        """
        Test successful approval request.

        Verifies that:
        - Approval request is created successfully
        - Response contains approval ID and status
        - POST endpoint is called exactly once

        Args:
            mock_response_factory: Injected mock response factory
        """
        approval_id = generate_id("approval")

        # Mock HTTP response
        mock_response = mock_response_factory(
            data={"id": approval_id, "status": "pending"},
            error=None,
        )
        self.client._client.post = Mock(return_value=mock_response)

        result = self.client.request_approval(
            plan_id=self.plan_id,
            task_id=self.task_id,
            tool="Bash",
            input_data={"command": "rm -rf /tmp/test"},
            reason="Matches deny rule: Bash(rm -rf *)",
        )

        assert result.error is None, f"Expected no error, got: {result.error}"
        assert result.data == {"id": approval_id, "status": "pending"}
        self.client._client.post.assert_called_once()

    @pytest.mark.daemon
    @pytest.mark.approval
    def test_request_approval_http_error(self):
        """
        Test approval request with HTTP error.

        Verifies that:
        - HTTP errors are handled gracefully
        - Error message is returned to caller
        - No data is returned on error
        """
        self.client._client.post = Mock(side_effect=Exception("Connection error"))

        result = self.client.request_approval(
            plan_id=self.plan_id,
            task_id=self.task_id,
            tool="Bash",
            input_data={"command": "rm -rf /tmp/test"},
        )

        assert result.data is None, "Expected no data on error"
        assert result.error is not None, "Expected error message"
        assert "HTTP error" in result.error or "Request failed" in result.error

    @pytest.mark.daemon
    @pytest.mark.approval
    def test_wait_for_approval_approved(self, mock_response_factory):
        """
        Test waiting for approval that gets approved.

        Verifies that:
        - Polling continues until approval is granted
        - Approved status is returned
        - Response data contains correct status

        Args:
            mock_response_factory: Injected mock response factory
        """
        approval_id = generate_id("approval")

        # Mock first call returns pending, second returns approved
        pending_response = mock_response_factory(
            data={"id": approval_id, "status": "pending"},
            error=None,
        )
        approved_response = mock_response_factory(
            data={"id": approval_id, "status": "approved"},
            error=None,
        )

        call_count = [0]

        def mock_get(*args, **kwargs):
            resp = [pending_response, approved_response][call_count[0]]
            call_count[0] += 1
            return resp

        self.client._client.get = Mock(side_effect=mock_get)

        # Mock time.sleep to avoid delay
        with patch("time.sleep"):
            result = self.client.wait_for_approval(
                approval_id=approval_id,
                timeout_seconds=10,
                poll_interval=0.1,
            )

        assert result.error is None, f"Expected no error, got: {result.error}"
        assert result.data == "approved", f"Expected 'approved', got: {result.data}"

    @pytest.mark.daemon
    @pytest.mark.approval
    def test_wait_for_approval_denied(self, mock_response_factory):
        """
        Test waiting for approval that gets denied.

        Verifies that:
        - Polling stops when denied status is received
        - Denied status is returned correctly

        Args:
            mock_response_factory: Injected mock response factory
        """
        approval_id = generate_id("approval")

        mock_response = mock_response_factory(
            data={"id": approval_id, "status": "denied"},
            error=None,
        )
        self.client._client.get = Mock(return_value=mock_response)

        result = self.client.wait_for_approval(
            approval_id=approval_id,
            timeout_seconds=10,
        )

        assert result.error is None, f"Expected no error, got: {result.error}"
        assert result.data == "denied", f"Expected 'denied', got: {result.data}"

    @pytest.mark.daemon
    @pytest.mark.approval
    @pytest.mark.slow
    def test_wait_for_approval_timeout(self, mock_response_factory):
        """
        Test waiting for approval that times out.

        Verifies that:
        - Timeout is respected
        - Timeout status is returned after deadline
        - Polling stops after timeout period

        Args:
            mock_response_factory: Injected mock response factory
        """
        approval_id = generate_id("approval")

        # Always return pending
        mock_response = mock_response_factory(
            data={"id": approval_id, "status": "pending"},
            error=None,
        )
        self.client._client.get = Mock(return_value=mock_response)

        import time

        # Mock time.time to simulate timeout
        original_time = time.time()
        call_count = [0]

        def mock_time():
            call_count[0] += 1
            if call_count[0] == 1:
                return original_time
            return original_time + 1000  # Past any reasonable timeout

        with patch("time.time", side_effect=mock_time):
            result = self.client.wait_for_approval(
                approval_id=approval_id,
                timeout_seconds=10,
                poll_interval=0.1,
            )

        assert result.error is None, f"Expected no error, got: {result.error}"
        assert result.data == "timeout", f"Expected 'timeout', got: {result.data}"


class TestDenyRules:
    """
    Test deny rule matching logic.

    Tests the deny rule system including:
    - Exact tool name matching
    - Pattern matching with wildcards
    - Substring matching
    - Rule priority and precedence
    """

    @pytest.mark.approval
    def test_exact_tool_match(self):
        """
        Test exact tool name match.

        Verifies that:
        - Exact tool names in deny rules are matched
        - Matched rule is returned correctly
        """
        deny_rules = ["Bash", "Write", "Edit"]

        needs_approval, matched = _check_deny_rules(
            tool_name="Bash",
            tool_input={"command": "ls"},
            deny_rules=deny_rules,
        )

        assert needs_approval is True, "Expected approval needed for Bash"
        assert matched == "Bash", f"Expected 'Bash', got: {matched}"

    @pytest.mark.approval
    def test_pattern_match_wildcard(self):
        """
        Test pattern match with wildcard.

        Verifies that:
        - Wildcard patterns match any character sequence
        - Command patterns are correctly matched
        """
        deny_rules = ["Bash(rm -rf *)"]

        needs_approval, matched = _check_deny_rules(
            tool_name="Bash",
            tool_input={"command": "rm -rf /tmp/test"},
            deny_rules=deny_rules,
        )

        assert needs_approval is True, "Expected approval needed for rm -rf"
        assert matched == "Bash(rm -rf *)", f"Expected wildcard match, got: {matched}"

    @pytest.mark.approval
    def test_pattern_match_substring(self):
        """
        Test pattern match without wildcard.

        Verifies that:
        - Substring matching works for command patterns
        - Partial matches are detected correctly
        """
        deny_rules = ["Bash(rm -rf /tmp)"]

        needs_approval, matched = _check_deny_rules(
            tool_name="Bash",
            tool_input={"command": "rm -rf /tmp/test"},
            deny_rules=deny_rules,
        )

        assert needs_approval is True, "Expected approval needed for substring match"
        assert matched == "Bash(rm -rf /tmp)", f"Expected substring match, got: {matched}"

    @pytest.mark.approval
    def test_no_match(self):
        """
        Test no matching rule.

        Verifies that:
        - Safe operations don't require approval
        - Empty string is returned when no match
        """
        deny_rules = ["Bash(rm -rf *)", "Write(/etc/*)"]

        needs_approval, matched = _check_deny_rules(
            tool_name="Bash",
            tool_input={"command": "ls -la"},
            deny_rules=deny_rules,
        )

        assert needs_approval is False, "Expected no approval needed for safe command"
        assert matched == "", f"Expected empty match, got: {matched}"

    @pytest.mark.approval
    def test_different_tool(self):
        """
        Test different tool not in rules.

        Verifies that:
        - Tools not in deny rules don't require approval
        - Tool names are matched exactly
        """
        deny_rules = ["Bash", "Edit"]

        needs_approval, matched = _check_deny_rules(
            tool_name="Read",
            tool_input={"path": "/tmp/file.txt"},
            deny_rules=deny_rules,
        )

        assert needs_approval is False, "Expected no approval needed for Read"
        assert matched == "", f"Expected empty match, got: {matched}"

    @pytest.mark.approval
    def test_empty_deny_rules(self):
        """
        Test with empty deny rules list.

        Verifies that:
        - Empty deny rules list doesn't require approval
        - System handles empty rules gracefully
        """
        deny_rules = []

        needs_approval, matched = _check_deny_rules(
            tool_name="Bash",
            tool_input={"command": "rm -rf /tmp"},
            deny_rules=deny_rules,
        )

        assert needs_approval is False, "Expected no approval with empty rules"
        assert matched == "", f"Expected empty match, got: {matched}"


class TestLoadDenyRules:
    """
    Test loading deny rules from settings.local.json.

    Tests configuration loading including:
    - Successful rule loading
    - Missing configuration files
    - Invalid JSON handling
    - Workspace priority over cwd
    """

    @pytest.mark.approval
    def test_load_deny_rules_success(self, tmp_path):
        """
        Test successfully loading deny rules.

        Verifies that:
        - Rules are loaded from settings file
        - Permissions.deny section is parsed correctly

        Args:
            tmp_path: Pytest tmp_path fixture
        """
        settings_path = tmp_path / ".claude" / "settings.local.json"
        settings_path.parent.mkdir(parents=True)
        settings_path.write_text(
            json.dumps(
                {
                    "permissions": {
                        "deny": ["Bash", "Write(/etc/*)", "Edit(*.password)"]
                    }
                }
            )
        )

        rules = _load_deny_rules(str(tmp_path), str(tmp_path))

        assert rules == ["Bash", "Write(/etc/*)", "Edit(*.password)"]

    @pytest.mark.approval
    def test_load_deny_rules_no_file(self, tmp_path):
        """
        Test loading when settings file doesn't exist.

        Verifies that:
        - Missing file returns empty rules list
        - No error is raised for missing config

        Args:
            tmp_path: Pytest tmp_path fixture
        """
        rules = _load_deny_rules(str(tmp_path), str(tmp_path))

        assert rules == [], "Expected empty rules for missing file"

    @pytest.mark.approval
    def test_load_deny_rules_no_permissions(self, tmp_path):
        """
        Test loading when permissions section is missing.

        Verifies that:
        - Missing permissions section returns empty rules
        - Settings without permissions are handled gracefully

        Args:
            tmp_path: Pytest tmp_path fixture
        """
        settings_path = tmp_path / ".claude" / "settings.local.json"
        settings_path.parent.mkdir(parents=True)
        settings_path.write_text(json.dumps({"env": {"TEST": "value"}}))

        rules = _load_deny_rules(str(tmp_path), str(tmp_path))

        assert rules == [], "Expected empty rules for missing permissions"

    @pytest.mark.approval
    def test_load_deny_rules_invalid_json(self, tmp_path):
        """
        Test loading with invalid JSON.

        Verifies that:
        - Invalid JSON returns empty rules
        - Malformed files are handled gracefully

        Args:
            tmp_path: Pytest tmp_path fixture
        """
        settings_path = tmp_path / ".claude" / "settings.local.json"
        settings_path.parent.mkdir(parents=True)
        settings_path.write_text("invalid json")

        rules = _load_deny_rules(str(tmp_path), str(tmp_path))

        assert rules == [], "Expected empty rules for invalid JSON"

    @pytest.mark.approval
    def test_load_deny_rules_workspace_fallback(self, tmp_path):
        """
        Test workspace priority over cwd.

        Verifies that:
        - Workspace settings are preferred over cwd settings
        - Settings file lookup follows correct priority

        Args:
            tmp_path: Pytest tmp_path fixture
        """
        # Create workspace settings
        workspace_path = tmp_path / "workspace"
        workspace_path.mkdir(parents=True)
        workspace_settings = workspace_path / ".claude" / "settings.local.json"
        workspace_settings.parent.mkdir(parents=True)
        workspace_settings.write_text(
            json.dumps({"permissions": {"deny": ["Bash"]}})
        )

        # Create cwd settings
        cwd_path = tmp_path / "cwd"
        cwd_path.mkdir(parents=True)

        # Should use workspace settings
        rules = _load_deny_rules(str(workspace_path), str(cwd_path))

        assert rules == ["Bash"], "Expected workspace rules to be used"
