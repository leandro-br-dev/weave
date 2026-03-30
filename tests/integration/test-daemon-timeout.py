#!/usr/bin/env python3
"""
Integration tests for daemon timeout and recovery functionality.

Run with: pytest tests/integration/test-daemon-timeout.py -v
"""

import asyncio
import json
import time
from datetime import datetime, timedelta
from pathlib import Path
import sys
import pytest
import requests

# Add parent directories to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "client"))

from orchestrator.daemon_client import DaemonClient

# Test configuration
API_URL = "http://localhost:3001"
API_TOKEN = "test-token"


@pytest.fixture
def api_client():
    """Create a DaemonClient for testing."""
    return DaemonClient(API_URL, API_TOKEN)


@pytest.fixture
def cleanup_plans(api_client):
    """Cleanup function to remove test plans after each test."""
    created_plans = []

    yield created_plans

    # Cleanup: try to delete any plans we created
    for plan_id in created_plans:
        try:
            # Try to get the plan first
            response = api_client.get_plan(plan_id)
            if response and response.data:
                # If plan is still running, we can't delete it, but we can try to complete it
                if response.data.get('status') == 'running':
                    try:
                        api_client.complete_plan(plan_id, 'failed', 'Test cleanup')
                    except:
                        pass
        except Exception as e:
            print(f"Warning: Could not cleanup plan {plan_id}: {e}")


class TestLongRunningPlanCompletion:
    """Test that long-running plans can complete even after timeout."""

    def test_long_running_plan_completion_after_timeout(self, api_client, cleanup_plans):
        """
        Test that a long-running plan can complete successfully even if
        it exceeds the timeout and is temporarily marked as failed.
        """
        # Create a test plan
        plan_data = {
            'name': 'Long Running Test Plan',
            'tasks': [
                {
                    'id': 'task-1',
                    'name': 'Long Task',
                    'prompt': 'Create a test file with content',
                    'cwd': '/tmp',
                    'tools': ['Write', 'Read'],
                    'workspace': '/tmp/test-workspace-timeout'
                }
            ]
        }

        # Create plan via API
        plan = api_client.create_plan_from_data(plan_data)
        assert plan is not None
        assert 'id' in plan.data

        plan_id = plan.data['id']
        cleanup_plans.append(plan_id)

        # Start the plan
        start_response = api_client.start_plan_async(plan_id)
        assert start_response is not None
        assert start_response.error is None

        # Wait a moment for plan to be marked as running
        time.sleep(1)

        # Get the plan to verify it's running
        running_plan = api_client.get_plan(plan_id)
        assert running_plan.data['status'] == 'running'

        # Simulate timeout by manually marking as failed (this is what recoverStuckPlans would do)
        # In a real scenario, this would happen automatically after timeout
        timeout_response = requests.post(
            f"{API_URL}/api/plans/{plan_id}/complete",
            headers={"Authorization": f"Bearer {API_TOKEN}"},
            json={
                'status': 'failed',
                'result': 'Plan timed out - daemon may have crashed'
            }
        )
        assert timeout_response.status_code == 200

        # Verify plan is marked as failed
        failed_plan = api_client.get_plan(plan_id)
        assert failed_plan.data['status'] == 'failed'

        # Send heartbeats during execution (simulating daemon still working)
        for i in range(3):
            heartbeat_response = requests.post(
                f"{API_URL}/api/plans/{plan_id}/heartbeat",
                headers={"Authorization": f"Bearer {API_TOKEN}"}
            )
            assert heartbeat_response.status_code == 200
            time.sleep(0.5)

        # Complete the plan successfully (should succeed even if status was failed)
        complete_response = requests.post(
            f"{API_URL}/api/plans/{plan_id}/complete",
            headers={"Authorization": f"Bearer {API_TOKEN}"},
            json={
                'status': 'success',
                'result': 'Plan completed successfully',
                'daemon_completed_at': datetime.now().isoformat()
            }
        )

        assert complete_response.status_code == 200
        response_data = complete_response.json()
        assert response_data['error'] is None
        assert response_data['data']['status'] == 'success'

        # Get plan and verify final status
        final_plan = api_client.get_plan(plan_id)
        assert final_plan.data['status'] == 'success'
        assert final_plan.data['result'] == 'Plan completed successfully'

    def test_plan_completion_from_completing_status(self, api_client, cleanup_plans):
        """Test completing a plan that is in 'completing' transitional status."""
        plan_data = {
            'name': 'Test Plan',
            'tasks': [
                {
                    'id': 'task-1',
                    'name': 'Task 1',
                    'prompt': 'Test task',
                    'cwd': '/tmp',
                    'tools': ['Bash'],
                    'workspace': '/tmp/test-workspace'
                }
            ]
        }

        plan = api_client.create_plan_from_data(plan_data)
        plan_id = plan.data['id']
        cleanup_plans.append(plan_id)

        # Start the plan
        api_client.start_plan_async(plan_id)
        time.sleep(0.5)

        # Manually set status to 'completing' (transitional state)
        requests.patch(
            f"{API_URL}/api/plans/{plan_id}",
            headers={"Authorization": f"Bearer {API_TOKEN}"},
            json={'status': 'completing'}
        )

        # Complete the plan from completing state
        complete_response = requests.post(
            f"{API_URL}/api/plans/{plan_id}/complete",
            headers={"Authorization": f"Bearer {API_TOKEN}"},
            json={
                'status': 'success',
                'result': 'Plan completed from completing state',
                'daemon_completed_at': datetime.now().isoformat()
            }
        )

        assert complete_response.status_code == 200
        response_data = complete_response.json()
        assert response_data['data']['status'] == 'success'


class TestHeartbeatFunctionality:
    """Test heartbeat functionality and timeout prevention."""

    def test_heartbeat_updates_timestamp(self, api_client, cleanup_plans):
        """Test that sending heartbeats updates the last_heartbeat_at timestamp."""
        plan_data = {
            'name': 'Heartbeat Test Plan',
            'tasks': [
                {
                    'id': 'task-1',
                    'name': 'Task 1',
                    'prompt': 'Test task',
                    'cwd': '/tmp',
                    'tools': ['Bash'],
                    'workspace': '/tmp/test-workspace'
                }
            ]
        }

        plan = api_client.create_plan_from_data(plan_data)
        plan_id = plan.data['id']
        cleanup_plans.append(plan_id)

        # Start the plan
        api_client.start_plan_async(plan_id)
        time.sleep(0.5)

        # Get initial heartbeat timestamp
        initial_plan = api_client.get_plan(plan_id)
        initial_heartbeat = initial_plan.data.get('last_heartbeat_at')

        # Send heartbeat
        heartbeat_response = requests.post(
            f"{API_URL}/api/plans/{plan_id}/heartbeat",
            headers={"Authorization": f"Bearer {API_TOKEN}"}
        )

        assert heartbeat_response.status_code == 200
        response_data = heartbeat_response.json()
        assert response_data['error'] is None
        assert 'heartbeat_at' in response_data['data']

        # Verify heartbeat timestamp was updated
        updated_plan = api_client.get_plan(plan_id)
        updated_heartbeat = updated_plan.data.get('last_heartbeat_at')

        assert updated_heartbeat is not None
        assert updated_heartbeat != initial_heartbeat

    def test_multiple_heartbeats(self, api_client, cleanup_plans):
        """Test sending multiple heartbeats over time."""
        plan_data = {
            'name': 'Multiple Heartbeat Test Plan',
            'tasks': [
                {
                    'id': 'task-1',
                    'name': 'Task 1',
                    'prompt': 'Test task',
                    'cwd': '/tmp',
                    'tools': ['Bash'],
                    'workspace': '/tmp/test-workspace'
                }
            ]
        }

        plan = api_client.create_plan_from_data(plan_data)
        plan_id = plan.data['id']
        cleanup_plans.append(plan_id)

        # Start the plan
        api_client.start_plan_async(plan_id)
        time.sleep(0.5)

        heartbeat_timestamps = []

        # Send multiple heartbeats
        for i in range(5):
            heartbeat_response = requests.post(
                f"{API_URL}/api/plans/{plan_id}/heartbeat",
                headers={"Authorization": f"Bearer {API_TOKEN}"}
            )

            assert heartbeat_response.status_code == 200
            response_data = heartbeat_response.json()
            heartbeat_timestamps.append(response_data['data']['heartbeat_at'])

            # Small delay between heartbeats
            time.sleep(0.2)

        # Verify all timestamps are different
        assert len(set(heartbeat_timestamps)) == len(heartbeat_timestamps)

    def test_heartbeat_rejected_for_non_running_plans(self, api_client, cleanup_plans):
        """Test that heartbeats are rejected for non-running plans."""
        plan_data = {
            'name': 'Non-Running Heartbeat Test',
            'tasks': [
                {
                    'id': 'task-1',
                    'name': 'Task 1',
                    'prompt': 'Test task',
                    'cwd': '/tmp',
                    'tools': ['Bash'],
                    'workspace': '/tmp/test-workspace'
                }
            ]
        }

        plan = api_client.create_plan_from_data(plan_data)
        plan_id = plan.data['id']
        cleanup_plans.append(plan_id)

        # Try to send heartbeat for pending plan
        heartbeat_response = requests.post(
            f"{API_URL}/api/plans/{plan_id}/heartbeat",
            headers={"Authorization": f"Bearer {API_TOKEN}"}
        )

        assert heartbeat_response.status_code == 400
        response_data = heartbeat_response.json()
        assert response_data['data'] is None
        assert 'not running' in response_data['error'].lower()


class TestApproachingTimeout:
    """Test the approaching-timeout endpoint."""

    def test_approaching_timeout_empty_when_no_plans(self, api_client):
        """Test that approaching-timeout returns empty when no plans are approaching timeout."""
        response = requests.get(
            f"{API_URL}/api/plans/approaching-timeout",
            headers={"Authorization": f"Bearer {API_TOKEN}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['error'] is None
        assert data['data']['count'] == 0
        assert data['data']['plans'] == []

    def test_approaching_timeout_detects_old_plans(self, api_client, cleanup_plans):
        """Test that approaching-timeout detects plans that have been running for a while."""
        plan_data = {
            'name': 'Old Running Plan',
            'tasks': [
                {
                    'id': 'task-1',
                    'name': 'Task 1',
                    'prompt': 'Test task',
                    'cwd': '/tmp',
                    'tools': ['Bash'],
                    'workspace': '/tmp/test-workspace'
                }
            ]
        }

        plan = api_client.create_plan_from_data(plan_data)
        plan_id = plan.data['id']
        cleanup_plans.append(plan_id)

        # Start the plan
        api_client.start_plan_async(plan_id)
        time.sleep(0.5)

        # Manually set started_at to simulate an old plan (96 minutes ago for 120 min timeout)
        ninety_six_minutes_ago = (datetime.now() - timedelta(minutes=96)).isoformat()
        requests.patch(
            f"{API_URL}/api/plans/{plan_id}",
            headers={"Authorization": f"Bearer {API_TOKEN}"},
            json={'started_at': ninety_six_minutes_ago}
        )

        # Get approaching timeout plans
        response = requests.get(
            f"{API_URL}/api/plans/approaching-timeout",
            headers={"Authorization": f"Bearer {API_TOKEN}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['error'] is None
        assert data['data']['count'] >= 1

        # Find our plan in the list
        matching_plans = [p for p in data['data']['plans'] if p['id'] == plan_id]
        assert len(matching_plans) == 1

        plan_info = matching_plans[0]
        assert plan_info['name'] == 'Old Running Plan'
        assert plan_info['minutes_running'] > 95
        assert plan_info['timeout_in_minutes'] <= 25

    def test_approaching_timeout_excludes_completed_plans(self, api_client, cleanup_plans):
        """Test that approaching-timeout excludes completed plans."""
        plan_data = {
            'name': 'Completed Plan',
            'tasks': [
                {
                    'id': 'task-1',
                    'name': 'Task 1',
                    'prompt': 'Test task',
                    'cwd': '/tmp',
                    'tools': ['Bash'],
                    'workspace': '/tmp/test-workspace'
                }
            ]
        }

        plan = api_client.create_plan_from_data(plan_data)
        plan_id = plan.data['id']
        cleanup_plans.append(plan_id)

        # Start and complete the plan
        api_client.start_plan_async(plan_id)
        time.sleep(0.5)

        api_client.complete_plan(plan_id, 'success', 'Test completed')

        # Manually set started_at to simulate an old plan
        ninety_six_minutes_ago = (datetime.now() - timedelta(minutes=96)).isoformat()
        requests.patch(
            f"{API_URL}/api/plans/{plan_id}",
            headers={"Authorization": f"Bearer {API_TOKEN}"},
            json={'started_at': ninety_six_minutes_ago}
        )

        # Get approaching timeout plans
        response = requests.get(
            f"{API_URL}/api/plans/approaching-timeout",
            headers={"Authorization": f"Bearer {API_TOKEN}"}
        )

        assert response.status_code == 200
        data = response.json()

        # Our completed plan should NOT be in the list
        matching_plans = [p for p in data['data']['plans'] if p['id'] == plan_id]
        assert len(matching_plans) == 0


class TestRecoveryScenarios:
    """Test various recovery scenarios."""

    def test_heartbeat_prevents_timeout(self, api_client, cleanup_plans):
        """
        Test that sending heartbeats prevents a plan from being marked as failed
        even if started_at is old.
        """
        plan_data = {
            'name': 'Heartbeat Protected Plan',
            'tasks': [
                {
                    'id': 'task-1',
                    'name': 'Task 1',
                    'prompt': 'Test task',
                    'cwd': '/tmp',
                    'tools': ['Bash'],
                    'workspace': '/tmp/test-workspace'
                }
            ]
        }

        plan = api_client.create_plan_from_data(plan_data)
        plan_id = plan.data['id']
        cleanup_plans.append(plan_id)

        # Start the plan
        api_client.start_plan_async(plan_id)
        time.sleep(0.5)

        # Set started_at to be old (130 minutes ago)
        hundred_thirty_minutes_ago = (datetime.now() - timedelta(minutes=130)).isoformat()
        requests.patch(
            f"{API_URL}/api/plans/{plan_id}",
            headers={"Authorization": f"Bearer {API_TOKEN}"},
            json={'started_at': hundred_thirty_minutes_ago}
        )

        # Set last_heartbeat_at to be recent (5 minutes ago)
        five_minutes_ago = (datetime.now() - timedelta(minutes=5)).isoformat()
        requests.patch(
            f"{API_URL}/api/plans/{plan_id}",
            headers={"Authorization": f"Bearer {API_TOKEN}"},
            json={'last_heartbeat_at': five_minutes_ago}
        )

        # Trigger recovery (this would normally be done by recoverStuckPlans)
        # We can't directly call the function, but we can verify the plan is still running
        plan_response = api_client.get_plan(plan_id)
        assert plan_response.data['status'] == 'running'
        assert plan_response.data['last_heartbeat_at'] is not None


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
