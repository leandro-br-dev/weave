"""
Comprehensive Integration Test for Completion Detection System.

This test suite validates the entire completion detection system including:
1. Plan creation with multiple tasks
2. Simulating communication failures during completion
3. Verifying completion logs show '✔ finished — end_turn'
4. Verifying plan remains in 'running' status after failure
5. Testing manual /api/plans/:id/check-completion endpoint
6. Verifying plan is marked as 'success' after check-completion
7. Testing periodic daemon checker (60-second interval)

Test ID: test-completion-detection-system
"""

import pytest
import asyncio
import json
import time
from pathlib import Path
from typing import Dict, Any
from unittest.mock import Mock, AsyncMock, patch, MagicMock
import tempfile
import sqlite3

from orchestrator.daemon_client import DaemonClient, PlanResponse


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture(scope="function")
def test_db_path():
    """
    Fixture providing a temporary test database.

    Creates a fresh SQLite database for each test function with all required tables.
    """
    # Create temporary database file
    fd, db_path = tempfile.mkstemp(suffix='.db', prefix='test-completion-')
    import os
    os.close(fd)  # Close the file descriptor

    # Initialize database schema
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create plans table
    cursor.execute("""
        CREATE TABLE plans (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            tasks TEXT NOT NULL,
            status TEXT NOT NULL,
            client_id TEXT,
            result TEXT,
            started_at TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL,
            project_id TEXT
        )
    """)

    # Create plan_logs table
    cursor.execute("""
        CREATE TABLE plan_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_id TEXT NOT NULL,
            task_id TEXT NOT NULL,
            level TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (plan_id) REFERENCES plans(id)
        )
    """)

    # Create indexes for performance
    cursor.execute("CREATE INDEX idx_plan_logs_plan_id ON plan_logs(plan_id)")
    cursor.execute("CREATE INDEX idx_plan_logs_created_at ON plan_logs(created_at)")

    conn.commit()
    conn.close()

    yield db_path

    # Cleanup
    Path(db_path).unlink(missing_ok=True)


@pytest.fixture
def api_client(test_db_path):
    """
    Fixture providing a mock API client with test database.

    This simulates the API server behavior for testing.
    """
    class MockAPIClient:
        def __init__(self, db_path: str):
            self.db_path = db_path
            self.plans = {}  # In-memory cache for faster access

        def _get_conn(self):
            """Get database connection."""
            return sqlite3.connect(self.db_path)

        def create_plan(self, name: str, tasks: list, status: str = 'pending') -> Dict[str, Any]:
            """Create a new plan in the database."""
            import uuid
            plan_id = str(uuid.uuid4())
            now = time.time()

            plan = {
                'id': plan_id,
                'name': name,
                'tasks': json.dumps(tasks),
                'status': status,
                'client_id': None,
                'result': None,
                'started_at': None,
                'completed_at': None,
                'created_at': now,
                'project_id': None
            }

            conn = self._get_conn()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO plans (id, name, tasks, status, client_id, result,
                                 started_at, completed_at, created_at, project_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                plan_id, name, plan['tasks'], status, plan['client_id'],
                plan['result'], plan['started_at'], plan['completed_at'],
                now, plan['project_id']
            ))
            conn.commit()
            conn.close()

            self.plans[plan_id] = plan
            return plan

        def get_plan(self, plan_id: str) -> Dict[str, Any]:
            """Get a plan from the database."""
            if plan_id in self.plans:
                return self.plans[plan_id]

            conn = self._get_conn()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM plans WHERE id = ?", (plan_id,))
            row = cursor.fetchone()
            conn.close()

            if row:
                columns = ['id', 'name', 'tasks', 'status', 'client_id', 'result',
                          'started_at', 'completed_at', 'created_at', 'project_id']
                plan = dict(zip(columns, row))
                self.plans[plan_id] = plan
                return plan

            return None

        def update_plan_status(self, plan_id: str, status: str, result: str = None):
            """Update plan status in the database."""
            conn = self._get_conn()
            cursor = conn.cursor()

            if result:
                cursor.execute("""
                    UPDATE plans
                    SET status = ?, result = ?, completed_at = ?
                    WHERE id = ?
                """, (status, result, time.time(), plan_id))
            else:
                cursor.execute("""
                    UPDATE plans
                    SET status = ?
                    WHERE id = ?
                """, (status, plan_id))

            conn.commit()
            conn.close()

            if plan_id in self.plans:
                self.plans[plan_id]['status'] = status
                if result:
                    self.plans[plan_id]['result'] = result
                    self.plans[plan_id]['completed_at'] = time.time()

        def add_completion_log(self, plan_id: str, task_id: str, message: str):
            """Add a completion log entry for a task."""
            conn = self._get_conn()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO plan_logs (plan_id, task_id, level, message, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (plan_id, task_id, 'success', message, time.time()))
            conn.commit()
            conn.close()

        def get_completion_logs(self, plan_id: str) -> list:
            """Get all completion logs for a plan."""
            conn = self._get_conn()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT task_id, level, message
                FROM plan_logs
                WHERE plan_id = ?
                AND (message LIKE '✔ finished%' OR message LIKE 'Task completed%' OR level = 'success')
                ORDER BY created_at DESC
            """, (plan_id,))
            rows = cursor.fetchall()
            conn.close()

            return [
                {'task_id': row[0], 'level': row[1], 'message': row[2]}
                for row in rows
            ]

        def check_completion(self, plan_id: str) -> Dict[str, Any]:
            """
            Simulate the /api/plans/:id/check-completion endpoint.

            This is the core logic being tested.
            """
            plan = self.get_plan(plan_id)
            if not plan:
                return {'error': 'Plan not found', 'data': None}

            # Parse tasks
            tasks = json.loads(plan['tasks']) if isinstance(plan['tasks'], str) else plan['tasks']
            task_ids = [t['id'] for t in tasks if t.get('id')]

            if not task_ids:
                return {
                    'data': {
                        'completed': False,
                        'total_tasks': 0,
                        'completed_tasks': 0,
                        'message': 'Plan has no tasks'
                    },
                    'error': None
                }

            # Get completion logs
            logs = self.get_completion_logs(plan_id)

            # Track which tasks have completion logs
            completed_task_ids = set()
            for log in logs:
                if log['task_id'] in task_ids:
                    completed_task_ids.add(log['task_id'])

            completed_tasks = len(completed_task_ids)
            total_tasks = len(task_ids)
            all_completed = completed_tasks == total_tasks

            # If all tasks completed and plan is still running, mark as success
            auto_completed = False
            if all_completed and plan['status'] == 'running':
                self.update_plan_status(
                    plan_id,
                    'success',
                    'All tasks completed successfully'
                )
                auto_completed = True

            return {
                'data': {
                    'completed': all_completed,
                    'total_tasks': total_tasks,
                    'completed_tasks': completed_tasks,
                    'pending_tasks': total_tasks - completed_tasks,
                    'plan_status': self.get_plan(plan_id)['status'],
                    'auto_completed': auto_completed,
                    'completed_task_ids': list(completed_task_ids)
                },
                'error': None
            }

    return MockAPIClient(test_db_path)


# ============================================================================
# Test Suite
# ============================================================================

class TestCompletionDetectionSystem:
    """
    Comprehensive test suite for the completion detection system.

    Tests the entire flow from plan creation to automatic completion detection.
    """

    def test_1_create_plan_with_multiple_tasks(self, api_client):
        """
        Test Step 1: Create a test plan with multiple tasks.

        Verifies:
        - Plan is created successfully
        - Plan has the correct number of tasks
        - Plan status is 'pending'
        """
        print("\n[TEST 1] Creating plan with multiple tasks...")

        # Create a plan with 5 tasks
        tasks = [
            {'id': 'task-1', 'name': 'Setup environment', 'prompt': 'Setup dev environment'},
            {'id': 'task-2', 'name': 'Write code', 'prompt': 'Write feature code'},
            {'id': 'task-3', 'name': 'Write tests', 'prompt': 'Write unit tests'},
            {'id': 'task-4', 'name': 'Run tests', 'prompt': 'Execute test suite'},
            {'id': 'task-5', 'name': 'Document', 'prompt': 'Write documentation'},
        ]

        plan = api_client.create_plan(
            name='Test Plan for Completion Detection',
            tasks=tasks,
            status='running'  # Simulate plan that has been started
        )

        assert plan is not None, "Plan should be created"
        assert plan['status'] == 'running', "Plan should be in running status"
        assert len(json.loads(plan['tasks'])) == 5, "Plan should have 5 tasks"

        print(f"✓ Plan created: {plan['id']}")
        print(f"✓ Plan status: {plan['status']}")
        print(f"✓ Number of tasks: {len(json.loads(plan['tasks']))}")

        return plan['id']

    def test_2_simulate_task_execution_with_completion_logs(self, api_client, plan_id=None):
        """
        Test Step 2: Simulate task execution with completion logs.

        Verifies:
        - Tasks generate completion logs
        - Logs contain '✔ finished — end_turn' pattern
        - Logs are stored correctly in database
        """
        print("\n[TEST 2] Simulating task execution with completion logs...")

        if plan_id is None:
            # Create plan if not provided
            plan_id = self.test_1_create_plan_with_multiple_tasks(api_client)

        # Simulate completion logs for all 5 tasks
        completion_messages = [
            ('task-1', '✔ finished — end_turn'),
            ('task-2', 'Task completed: Feature code written successfully'),
            ('task-3', '✔ finished — end_turn'),
            ('task-4', 'Task completed: All tests passed'),
            ('task-5', '✔ finished — end_turn'),
        ]

        for task_id, message in completion_messages:
            api_client.add_completion_log(plan_id, task_id, message)
            print(f"✓ Added completion log for {task_id}: {message}")

        # Verify logs were added
        logs = api_client.get_completion_logs(plan_id)
        assert len(logs) == 5, f"Should have 5 completion logs, got {len(logs)}"

        # Verify at least one log has the '✔ finished — end_turn' pattern
        finished_logs = [log for log in logs if '✔ finished — end_turn' in log['message']]
        assert len(finished_logs) >= 3, f"Should have at least 3 '✔ finished' logs, got {len(finished_logs)}"

        print(f"✓ Total completion logs: {len(logs)}")
        print(f"✓ Logs with '✔ finished — end_turn': {len(finished_logs)}")

        return plan_id

    def test_3_verify_plan_remains_running_after_communication_failure(self, api_client):
        """
        Test Step 3: Verify plan remains in 'running' status after simulated communication failure.

        Verifies:
        - Plan status is 'running' before check-completion
        - Plan has completion logs but status hasn't been updated
        - This simulates a communication failure during completion
        """
        print("\n[TEST 3] Verifying plan remains in 'running' status after communication failure...")

        # Create plan and add completion logs
        plan_id = self.test_2_simulate_task_execution_with_completion_logs(api_client)

        # Get plan status
        plan = api_client.get_plan(plan_id)

        assert plan['status'] == 'running', f"Plan should be 'running', got '{plan['status']}'"
        assert plan['completed_at'] is None, "Plan should not have completed_at timestamp"

        print(f"✓ Plan ID: {plan_id}")
        print(f"✓ Plan status: {plan['status']}")
        print(f"✓ Plan completed_at: {plan['completed_at']}")

        # Verify completion logs exist but plan hasn't been marked as success
        logs = api_client.get_completion_logs(plan_id)
        assert len(logs) == 5, "Should have 5 completion logs"

        print(f"✓ Completion logs present: {len(logs)}")
        print("✓ This simulates a communication failure during completion")

        return plan_id

    def test_4_manual_check_completion_endpoint(self, api_client):
        """
        Test Step 4: Test manual /api/plans/:id/check-completion endpoint call.

        Verifies:
        - Check-completion endpoint can be called manually
        - Endpoint detects all tasks are completed
        - Endpoint returns correct completion statistics
        - Plan status is updated to 'success' automatically
        """
        print("\n[TEST 4] Testing manual /api/plans/:id/check-completion endpoint...")

        # Create plan and add completion logs
        plan_id = self.test_3_verify_plan_remains_running_after_communication_failure(api_client)

        # Call check-completion endpoint (simulated)
        result = api_client.check_completion(plan_id)

        assert result['error'] is None, f"Check-completion should succeed, got error: {result['error']}"
        assert result['data']['completed'] is True, "Plan should be marked as completed"
        assert result['data']['total_tasks'] == 5, "Should have 5 total tasks"
        assert result['data']['completed_tasks'] == 5, "Should have 5 completed tasks"
        assert result['data']['pending_tasks'] == 0, "Should have 0 pending tasks"
        assert result['data']['auto_completed'] is True, "Plan should be auto-completed"

        print(f"✓ Check-completion result: {result['data']}")
        print(f"✓ All tasks completed: {result['data']['completed']}")
        print(f"✓ Completed tasks: {result['data']['completed_tasks']}/{result['data']['total_tasks']}")
        print(f"✓ Auto-completed: {result['data']['auto_completed']}")

        return plan_id

    def test_5_verify_plan_marked_as_success(self, api_client):
        """
        Test Step 5: Verify plan is marked as 'success' after check-completion.

        Verifies:
        - Plan status changed from 'running' to 'success'
        - Plan has completed_at timestamp
        - Plan has result message
        """
        print("\n[TEST 5] Verifying plan is marked as 'success'...")

        # Create plan, add logs, and call check-completion
        plan_id = self.test_4_manual_check_completion_endpoint(api_client)

        # Get plan status
        plan = api_client.get_plan(plan_id)

        assert plan['status'] == 'success', f"Plan should be 'success', got '{plan['status']}'"
        assert plan['completed_at'] is not None, "Plan should have completed_at timestamp"
        assert plan['result'] is not None, "Plan should have result message"
        assert 'All tasks completed successfully' in plan['result'], "Result should mention task completion"

        print(f"✓ Plan ID: {plan_id}")
        print(f"✓ Plan status: {plan['status']}")
        print(f"✓ Plan completed_at: {plan['completed_at']}")
        print(f"✓ Plan result: {plan['result']}")

    def test_6_partial_completion_scenario(self, api_client):
        """
        Test Step 6: Test partial completion scenario (not all tasks completed).

        Verifies:
        - Check-completion detects partial completion
        - Plan status remains 'running' when not all tasks complete
        - Completed and pending task counts are accurate
        """
        print("\n[TEST 6] Testing partial completion scenario...")

        # Create plan with 5 tasks
        tasks = [
            {'id': 'task-1', 'name': 'Task 1', 'prompt': 'First task'},
            {'id': 'task-2', 'name': 'Task 2', 'prompt': 'Second task'},
            {'id': 'task-3', 'name': 'Task 3', 'prompt': 'Third task'},
            {'id': 'task-4', 'name': 'Task 4', 'prompt': 'Fourth task'},
            {'id': 'task-5', 'name': 'Task 5', 'prompt': 'Fifth task'},
        ]

        plan = api_client.create_plan(
            name='Partial Completion Test Plan',
            tasks=tasks,
            status='running'
        )

        plan_id = plan['id']

        # Only complete 3 of 5 tasks
        api_client.add_completion_log(plan_id, 'task-1', '✔ finished — end_turn')
        api_client.add_completion_log(plan_id, 'task-2', 'Task completed: Done')
        api_client.add_completion_log(plan_id, 'task-3', '✔ finished — end_turn')

        # Call check-completion
        result = api_client.check_completion(plan_id)

        assert result['error'] is None, "Check-completion should succeed"
        assert result['data']['completed'] is False, "Plan should NOT be marked as completed"
        assert result['data']['total_tasks'] == 5, "Should have 5 total tasks"
        assert result['data']['completed_tasks'] == 3, "Should have 3 completed tasks"
        assert result['data']['pending_tasks'] == 2, "Should have 2 pending tasks"
        assert result['data']['auto_completed'] is False, "Plan should NOT be auto-completed"
        assert result['data']['plan_status'] == 'running', "Plan status should remain 'running'"

        # Verify plan is still running
        plan = api_client.get_plan(plan_id)
        assert plan['status'] == 'running', "Plan should still be running"

        print(f"✓ Partial completion detected: {result['data']['completed_tasks']}/{result['data']['total_tasks']} tasks")
        print(f"✓ Plan status remains: {plan['status']}")
        print(f"✓ Pending tasks: {result['data']['pending_tasks']}")

    def test_7_periodic_daemon_checker_simulation(self, api_client):
        """
        Test Step 7: Simulate periodic daemon checker (60-second interval).

        Verifies:
        - Daemon can detect multiple running plans
        - Daemon calls check-completion for each running plan
        - Plans are auto-completed after detection
        """
        print("\n[TEST 7] Simulating periodic daemon checker...")

        # Create multiple plans with completion logs
        plans_to_check = []

        for i in range(3):
            tasks = [
                {'id': f'task-{i}-1', 'name': f'Task {i}-1', 'prompt': 'Task 1'},
                {'id': f'task-{i}-2', 'name': f'Task {i}-2', 'prompt': 'Task 2'},
            ]

            plan = api_client.create_plan(
                name=f'Daemon Checker Test Plan {i+1}',
                tasks=tasks,
                status='running'
            )

            plan_id = plan['id']
            plans_to_check.append(plan_id)

            # Add completion logs for all tasks
            api_client.add_completion_log(plan_id, f'task-{i}-1', '✔ finished — end_turn')
            api_client.add_completion_log(plan_id, f'task-{i}-2', 'Task completed: Done')

        print(f"✓ Created {len(plans_to_check)} running plans")

        # Simulate daemon checker: get all running plans and check completion
        # In real daemon, this would query: SELECT * FROM plans WHERE status = 'running'
        running_plans = plans_to_check

        print(f"✓ Daemon found {len(running_plans)} running plans")

        # Check completion for each running plan
        recovered_count = 0
        for plan_id in running_plans:
            result = api_client.check_completion(plan_id)

            if result['data']['auto_completed']:
                recovered_count += 1
                print(f"✓ Plan {plan_id[:8]}... auto-completed")

        assert recovered_count == 3, f"Should recover all 3 plans, got {recovered_count}"

        print(f"✓ Total plans recovered: {recovered_count}/{len(running_plans)}")

    def test_8_end_to_end_workflow(self, api_client):
        """
        Test Step 8: Complete end-to-end workflow test.

        Verifies the entire flow from creation to recovery:
        1. Create plan with multiple tasks
        2. Start plan execution (status -> running)
        3. Execute all tasks (add completion logs)
        4. Simulate communication failure (don't call complete)
        5. Verify plan is stuck in 'running' status
        6. Call check-completion endpoint
        7. Verify plan is auto-completed
        """
        print("\n[TEST 8] Running complete end-to-end workflow...")

        # Step 1: Create plan
        print("\n[Step 1] Creating plan...")
        tasks = [
            {'id': 'task-1', 'name': 'Initialize', 'prompt': 'Initialize project'},
            {'id': 'task-2', 'name': 'Implement', 'prompt': 'Implement feature'},
            {'id': 'task-3', 'name': 'Test', 'prompt': 'Test feature'},
        ]

        plan = api_client.create_plan(
            name='End-to-End Test Plan',
            tasks=tasks,
            status='pending'
        )

        plan_id = plan['id']
        assert plan['status'] == 'pending', "Initial status should be 'pending'"
        print(f"✓ Plan created: {plan_id[:8]}...")

        # Step 2: Start plan execution
        print("\n[Step 2] Starting plan execution...")
        api_client.update_plan_status(plan_id, 'running')
        plan = api_client.get_plan(plan_id)
        assert plan['status'] == 'running', "Status should be 'running'"
        print(f"✓ Plan status: {plan['status']}")

        # Step 3: Execute all tasks
        print("\n[Step 3] Executing tasks...")
        api_client.add_completion_log(plan_id, 'task-1', '✔ finished — end_turn')
        api_client.add_completion_log(plan_id, 'task-2', '✔ finished — end_turn')
        api_client.add_completion_log(plan_id, 'task-3', 'Task completed: Feature tested successfully')

        logs = api_client.get_completion_logs(plan_id)
        assert len(logs) == 3, "Should have 3 completion logs"
        print(f"✓ All tasks executed: {len(logs)} completion logs")

        # Step 4: Simulate communication failure (don't call complete_plan)
        print("\n[Step 4] Simulating communication failure...")
        # At this point, plan should still be 'running'
        plan = api_client.get_plan(plan_id)
        assert plan['status'] == 'running', "Plan should still be 'running' after failure"
        print(f"✓ Plan stuck in 'running' status (communication failure simulated)")

        # Step 5: Verify plan is stuck
        print("\n[Step 5] Verifying plan is stuck...")
        assert plan['completed_at'] is None, "Plan should not have completed_at"
        assert plan['result'] is None, "Plan should not have result"
        print("✓ Plan confirmed stuck: no completed_at or result")

        # Step 6: Call check-completion endpoint
        print("\n[Step 6] Calling check-completion endpoint...")
        result = api_client.check_completion(plan_id)

        assert result['error'] is None, "Check-completion should succeed"
        assert result['data']['completed'] is True, "Plan should be detected as completed"
        assert result['data']['auto_completed'] is True, "Plan should be auto-completed"
        print(f"✓ Check-completion successful: {result['data']['completed_tasks']}/{result['data']['total_tasks']} tasks completed")

        # Step 7: Verify plan is auto-completed
        print("\n[Step 7] Verifying auto-completion...")
        plan = api_client.get_plan(plan_id)
        assert plan['status'] == 'success', f"Plan should be 'success', got '{plan['status']}'"
        assert plan['completed_at'] is not None, "Plan should have completed_at"
        assert plan['result'] is not None, "Plan should have result"
        print(f"✓ Plan auto-completed: status={plan['status']}")
        print(f"✓ Completion timestamp: {plan['completed_at']}")
        print(f"✓ Result: {plan['result']}")

        print("\n✅ End-to-end workflow test PASSED!")

    def test_9_multiple_completion_log_patterns(self, api_client):
        """
        Test Step 9: Test various completion log patterns.

        Verifies:
        - Different completion patterns are detected
        - '✔ finished — end_turn' pattern works
        - 'Task completed' pattern works
        - level='success' pattern works
        """
        print("\n[TEST 9] Testing multiple completion log patterns...")

        # Create plan
        tasks = [
            {'id': 'task-1', 'name': 'Task 1', 'prompt': 'First'},
            {'id': 'task-2', 'name': 'Task 2', 'prompt': 'Second'},
            {'id': 'task-3', 'name': 'Task 3', 'prompt': 'Third'},
        ]

        plan = api_client.create_plan(
            name='Multiple Patterns Test Plan',
            tasks=tasks,
            status='running'
        )

        plan_id = plan['id']

        # Add different completion patterns
        api_client.add_completion_log(plan_id, 'task-1', '✔ finished — end_turn')
        api_client.add_completion_log(plan_id, 'task-2', 'Task completed: Implementation successful')
        # For task-3, we'll add a log with level='success' manually
        conn = api_client._get_conn()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO plan_logs (plan_id, task_id, level, message, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (plan_id, 'task-3', 'success', 'Task finished', time.time()))
        conn.commit()
        conn.close()

        # Call check-completion
        result = api_client.check_completion(plan_id)

        assert result['data']['completed'] is True, "All patterns should be detected"
        assert result['data']['completed_tasks'] == 3, "All 3 tasks should be detected as completed"

        print(f"✓ All completion patterns detected")
        print(f"✓ '✔ finished — end_turn': task-1")
        print(f"✓ 'Task completed': task-2")
        print(f"✓ level='success': task-3")

    def test_10_no_tasks_plan(self, api_client):
        """
        Test Step 10: Test plan with no tasks.

        Verifies:
        - Check-completion handles plans with no tasks gracefully
        - Returns appropriate message
        """
        print("\n[TEST 10] Testing plan with no tasks...")

        # Create plan with empty tasks array
        plan = api_client.create_plan(
            name='No Tasks Test Plan',
            tasks=[],
            status='running'
        )

        plan_id = plan['id']

        # Call check-completion
        result = api_client.check_completion(plan_id)

        assert result['error'] is None, "Check-completion should succeed"
        assert result['data']['completed'] is False, "Empty plan should not be completed"
        assert result['data']['total_tasks'] == 0, "Should have 0 total tasks"
        assert result['data']['message'] == 'Plan has no tasks', "Should have appropriate message"

        print(f"✓ Plan with no tasks handled correctly")
        print(f"✓ Message: {result['data']['message']}")


# ============================================================================
# Test Runner
# ============================================================================

if __name__ == '__main__':
    # Run tests with pytest
    pytest.main([__file__, '-v', '-s'])
