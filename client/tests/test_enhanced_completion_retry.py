"""
Tests for enhanced complete_plan_with_retry functionality.

Tests the improved retry logic, verification, and recovery mechanisms.
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from pathlib import Path

from orchestrator.daemon_client import DaemonClient, PlanResponse


class TestEnhancedCompletionRetry:
    """Test suite for enhanced completion retry logic."""

    @pytest.fixture
    def client(self):
        """Create a DaemonClient instance for testing."""
        return DaemonClient(
            server_url="http://localhost:3001",
            token="test_token"
        )

    @pytest.fixture
    def recovery_file_path(self):
        """Return the path to the recovery file."""
        return Path('/tmp/weave-needs-recovery.json')

    def test_classify_error_permanent_errors(self, client):
        """Test classification of permanent errors that should not be retried."""
        test_cases = [
            ("Plan not found in API", ("not_found", True)),
            ("Plan not in running status", ("status_mismatch", True)),
            ("Bad Request: invalid data", ("bad_request", True)),
            ("400 Bad Request", ("bad_request", True)),
            ("401 Unauthorized", ("auth_error", True)),
            ("403 Forbidden", ("forbidden", True)),
            ("409 Conflict", ("conflict", True)),
            ("422 Validation Error", ("validation_error", True)),
        ]

        for error_msg, (expected_type, expected_permanent) in test_cases:
            error_type, is_permanent = client._classify_error(error_msg)
            assert error_type == expected_type, f"Expected type {expected_type} for: {error_msg}"
            assert is_permanent == expected_permanent, f"Expected permanent={expected_permanent} for: {error_msg}"

    def test_classify_error_transient_errors(self, client):
        """Test classification of transient errors that should be retried."""
        test_cases = [
            ("500 Internal Server Error", ("server_error", False)),
            ("502 Bad Gateway", ("gateway_error", False)),
            ("503 Service Unavailable", ("gateway_error", False)),
            ("504 Gateway Timeout", ("gateway_error", False)),
            ("Request timeout", ("timeout", False)),
            ("Connection error", ("connection_error", False)),
            ("Network temporarily unavailable", ("network_error", False)),
        ]

        for error_msg, (expected_type, expected_permanent) in test_cases:
            error_type, is_permanent = client._classify_error(error_msg)
            assert error_type == expected_type, f"Expected type {expected_type} for: {error_msg}"
            assert is_permanent == expected_permanent, f"Expected permanent={expected_permanent} for: {error_msg}"

    def test_classify_error_unknown(self, client):
        """Test classification of unknown errors (assumed transient)."""
        error_type, is_permanent = client._classify_error("Some unknown error occurred")
        assert error_type == "unknown"
        assert is_permanent == False  # Assume transient for unknown errors

    @pytest.mark.asyncio
    async def test_verify_completion_status_success(self, client):
        """Test successful verification of plan status."""
        plan_id = "test-plan-123"
        expected_status = "success"

        # Mock the HTTP response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'data': {'status': expected_status}
        }

        with patch.object(client._client, 'get', return_value=mock_response):
            result = await client._verify_completion_status(plan_id, expected_status, 1)

        assert result == "verified"

    @pytest.mark.asyncio
    async def test_verify_completion_status_mismatch(self, client):
        """Test verification when status doesn't match."""
        plan_id = "test-plan-123"
        expected_status = "success"
        actual_status = "running"

        # Mock the HTTP response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'data': {'status': actual_status}
        }

        with patch.object(client._client, 'get', return_value=mock_response):
            result = await client._verify_completion_status(plan_id, expected_status, 1)

        assert result == "mismatch"

    @pytest.mark.asyncio
    async def test_verify_completion_status_error(self, client):
        """Test verification when request fails."""
        plan_id = "test-plan-123"

        # Mock a failed HTTP response
        mock_response = Mock()
        mock_response.status_code = 500

        with patch.object(client._client, 'get', return_value=mock_response):
            result = await client._verify_completion_status(plan_id, "success", 1)

        assert result == "error"

    @pytest.mark.asyncio
    async def test_add_to_needs_recovery(self, client, recovery_file_path):
        """Test adding a plan to the recovery list."""
        plan_id = "test-plan-123"
        intended_status = "success"
        result_message = "All tasks completed"

        # Remove recovery file if it exists
        if recovery_file_path.exists():
            recovery_file_path.unlink()

        # Add plan to recovery
        await client._add_to_needs_recovery(plan_id, intended_status, result_message)

        # Verify file was created
        assert recovery_file_path.exists()

        # Read and verify contents
        import json
        with open(recovery_file_path, 'r') as f:
            recovery_list = json.load(f)

        assert len(recovery_list) == 1
        assert recovery_list[0]['plan_id'] == plan_id
        assert recovery_list[0]['intended_status'] == intended_status
        assert recovery_list[0]['result_message'] == result_message
        assert recovery_list[0]['attempts'] == 1
        assert 'added_at' in recovery_list[0]

        # Cleanup
        recovery_file_path.unlink()

    @pytest.mark.asyncio
    async def test_add_to_needs_recovery_duplicate(self, client, recovery_file_path):
        """Test that duplicate plans are not added to recovery list."""
        plan_id = "test-plan-123"

        # Remove recovery file if it exists
        if recovery_file_path.exists():
            recovery_file_path.unlink()

        # Add plan twice
        await client._add_to_needs_recovery(plan_id, "success")
        await client._add_to_needs_recovery(plan_id, "success")

        # Verify only one entry
        import json
        with open(recovery_file_path, 'r') as f:
            recovery_list = json.load(f)

        assert len(recovery_list) == 1

        # Cleanup
        recovery_file_path.unlink()

    @pytest.mark.asyncio
    async def test_complete_plan_with_retry_transient_error(self, client):
        """Test retry logic with transient errors."""
        plan_id = "test-plan-123"

        # Mock complete_plan to fail twice, then succeed
        call_count = 0

        def mock_complete(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                return PlanResponse(data=None, error="500 Internal Server Error")
            return PlanResponse(data={'id': plan_id, 'status': 'success'}, error=None)

        client.complete_plan = Mock(side_effect=mock_complete)

        # Mock verify_plan_exists to return True
        client.verify_plan_exists = AsyncMock(return_value=True)

        # Mock plan status fetch
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'data': {'status': 'running'}}

        with patch.object(client._client, 'get', return_value=mock_response):
            # Mock verification to succeed
            with patch.object(client, '_verify_completion_status', return_value='verified'):
                result = await client.complete_plan_with_retry(
                    plan_id,
                    "success",
                    max_retries=5
                )

        assert result is not None
        assert result.error is None
        assert call_count == 3  # Failed twice, succeeded on third try

    @pytest.mark.asyncio
    async def test_complete_plan_with_retry_permanent_error(self, client):
        """Test that permanent errors are not retried."""
        plan_id = "test-plan-123"

        # Mock complete_plan to fail with permanent error
        client.complete_plan = Mock(
            return_value=PlanResponse(data=None, error="Plan not found")
        )

        # Mock verify_plan_exists to return True
        client.verify_plan_exists = AsyncMock(return_value=True)

        # Mock plan status fetch
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'data': {'status': 'running'}}

        with patch.object(client._client, 'get', return_value=mock_response):
            result = await client.complete_plan_with_retry(
                plan_id,
                "success",
                max_retries=5
            )

        assert result is not None
        assert result.error == "Plan not found"
        assert client.complete_plan.call_count == 1  # Should not retry

    @pytest.mark.asyncio
    async def test_complete_plan_with_retry_verification_mismatch(self, client, recovery_file_path):
        """Test that verification mismatch adds to recovery list."""
        plan_id = "test-plan-123"

        # Remove recovery file if it exists
        if recovery_file_path.exists():
            recovery_file_path.unlink()

        # Mock complete_plan to succeed
        client.complete_plan = Mock(
            return_value=PlanResponse(data={'id': plan_id, 'status': 'success'}, error=None)
        )

        # Mock verify_plan_exists to return True
        client.verify_plan_exists = AsyncMock(return_value=True)

        # Mock plan status fetch
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'data': {'status': 'running'}}

        with patch.object(client._client, 'get', return_value=mock_response):
            # Mock verification to return mismatch
            with patch.object(client, '_verify_completion_status', return_value='mismatch'):
                with patch.object(client, '_add_to_needs_recovery', new=AsyncMock()) as mock_add:
                    result = await client.complete_plan_with_retry(
                        plan_id,
                        "success",
                        max_retries=3,
                        verify_completion=True
                    )

        # Should have called _add_to_needs_recovery
        mock_add.assert_called_once_with(plan_id, "success", None)
        assert result is not None  # Still returns success even though verification failed

    @pytest.mark.asyncio
    async def test_complete_plan_aggressive_backoff(self, client):
        """Test that aggressive retry uses shorter initial delays."""
        plan_id = "test-plan-123"

        # Mock complete_plan to always fail with transient error
        client.complete_plan = Mock(
            return_value=PlanResponse(data=None, error="500 Internal Server Error")
        )

        # Mock verify_plan_exists to return True
        client.verify_plan_exists = AsyncMock(return_value=True)

        # Mock plan status fetch
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'data': {'status': 'running'}}

        # Track sleep calls
        sleep_times = []

        async def mock_sleep(duration):
            sleep_times.append(duration)

        with patch.object(client._client, 'get', return_value=mock_response):
            with patch('asyncio.sleep', side_effect=mock_sleep):
                with patch.object(client, '_add_to_needs_recovery', new=AsyncMock()):
                    result = await client.complete_plan_with_retry(
                        plan_id,
                        "success",
                        max_retries=3
                    )

        # Verify backoff starts at 0.5s and increases
        # Note: actual values include jitter, so we check approximate ranges
        assert len(sleep_times) == 2  # max_retries=3, so 2 retries
        assert sleep_times[0] >= 0.4  # First wait should be at least 0.4s (with jitter)
        assert sleep_times[1] >= 0.8  # Second wait should be at least 0.8s (with jitter)

    @pytest.mark.asyncio
    async def test_complete_plan_exhausted_retries(self, client):
        """Test behavior when all retries are exhausted."""
        plan_id = "test-plan-123"

        # Mock complete_plan to always fail with transient error
        client.complete_plan = Mock(
            return_value=PlanResponse(data=None, error="500 Internal Server Error")
        )

        # Mock verify_plan_exists to return True
        client.verify_plan_exists = AsyncMock(return_value=True)

        # Mock plan status fetch
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'data': {'status': 'running'}}

        with patch.object(client._client, 'get', return_value=mock_response):
            with patch('asyncio.sleep', new=AsyncMock()):
                with patch.object(client, '_add_to_needs_recovery', new=AsyncMock()) as mock_add:
                    result = await client.complete_plan_with_retry(
                        plan_id,
                        "success",
                        max_retries=3
                    )

        # Should return None after exhausting retries
        assert result is None
        # Should have been added to recovery list
        mock_add.assert_called_once()
        # Should have attempted max_retries times
        assert client.complete_plan.call_count == 3


class TestRecoveryListProcessing:
    """Test suite for recovery list processing in main.py."""

    @pytest.mark.asyncio
    async def test_process_empty_recovery_list(self):
        """Test processing when recovery list doesn't exist."""
        from main import process_needs_recovery_list

        # Ensure file doesn't exist
        recovery_file = Path('/tmp/weave-needs-recovery.json')
        if recovery_file.exists():
            recovery_file.unlink()

        # Mock client
        client = Mock()

        # Should not raise any errors
        await process_needs_recovery_list(client)

    @pytest.mark.asyncio
    async def test_process_recovery_list_success(self):
        """Test successful recovery of a plan."""
        from main import process_needs_recovery_list
        import json
        import time

        recovery_file = Path('/tmp/weave-needs-recovery.json')

        # Create test recovery list
        plan_id = "test-plan-123"
        recovery_list = [{
            'plan_id': plan_id,
            'intended_status': 'success',
            'result_message': 'All tasks completed',
            'added_at': time.time(),
            'attempts': 1
        }]

        with open(recovery_file, 'w') as f:
            json.dump(recovery_list, f)

        # Mock client
        client = Mock()
        client._get = AsyncMock(return_value={
            'status': 'running',
            'id': plan_id
        })
        client.complete_plan_with_retry = AsyncMock(
            return_value=PlanResponse(
                data={'id': plan_id, 'status': 'success'},
                error=None
            )
        )

        # Process recovery list
        await process_needs_recovery_list(client)

        # Verify complete_plan_with_retry was called
        client.complete_plan_with_retry.assert_called_once()

        # Verify plan was removed from recovery list
        if recovery_file.exists():
            with open(recovery_file, 'r') as f:
                remaining = json.load(f)
            assert len(remaining) == 0  # Should be empty after successful recovery

        # Cleanup
        recovery_file.unlink()

    @pytest.mark.asyncio
    async def test_process_recovery_list_already_completed(self):
        """Test recovery when plan is already in intended status."""
        from main import process_needs_recovery_list
        import json
        import time

        recovery_file = Path('/tmp/weave-needs-recovery.json')

        # Create test recovery list
        plan_id = "test-plan-123"
        recovery_list = [{
            'plan_id': plan_id,
            'intended_status': 'success',
            'result_message': 'All tasks completed',
            'added_at': time.time(),
            'attempts': 1
        }]

        with open(recovery_file, 'w') as f:
            json.dump(recovery_list, f)

        # Mock client - plan already in success status
        client = Mock()
        client._get = AsyncMock(return_value={
            'status': 'success',  # Already in intended status
            'id': plan_id
        })

        # Process recovery list
        await process_needs_recovery_list(client)

        # Verify complete_plan_with_retry was NOT called
        client.complete_plan_with_retry.assert_not_called()

        # Verify plan was removed from recovery list
        if recovery_file.exists():
            with open(recovery_file, 'r') as f:
                remaining = json.load(f)
            assert len(remaining) == 0

        # Cleanup
        recovery_file.unlink()
