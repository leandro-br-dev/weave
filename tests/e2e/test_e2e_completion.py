#!/usr/bin/env python3
"""
End-to-End Test Suite for Completion Detection System

This script performs comprehensive testing with real servers running.
"""

import os
import sys
import time
import signal
import subprocess
import requests
import psycopg2
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class E2ETestRunner:
    """End-to-end test runner for completion detection system"""

    def __init__(self):
        self.api_process: Optional[subprocess.Popen] = None
        self.daemon_process: Optional[subprocess.Popen] = None
        self.base_url = "http://localhost:8000"
        self.test_plan_ids: List[str] = []
        self.test_results: List[Dict] = []

        # Database connection
        self.db_conn = psycopg2.connect(
            host=settings.DATABASE_HOST,
            port=settings.DATABASE_PORT,
            database=settings.DATABASE_NAME,
            user=settings.DATABASE_USER,
            password=settings.DATABASE_PASSWORD
        )
        self.db_conn.autocommit = True

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.cleanup()

    def start_servers(self) -> bool:
        """Start API and daemon servers"""
        logger.info("Starting servers...")

        # Start API server
        try:
            self.api_process = subprocess.Popen(
                [sys.executable, "-m", "uvicorn", "api.app:app", "--host", "0.0.0.0", "--port", "8000"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd="/root/projects/weave"
            )
            logger.info("API server started")
        except Exception as e:
            logger.error(f"Failed to start API server: {e}")
            return False

        # Start daemon
        try:
            self.daemon_process = subprocess.Popen(
                [sys.executable, "-m", "daemon.main"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd="/root/projects/weave"
            )
            logger.info("Daemon server started")
        except Exception as e:
            logger.error(f"Failed to start daemon: {e}")
            return False

        # Wait for servers to be ready
        time.sleep(5)

        # Verify API is running
        try:
            response = requests.get(f"{self.base_url}/health", timeout=5)
            if response.status_code == 200:
                logger.info("✓ API server is responding")
                return True
            else:
                logger.error("API server not responding correctly")
                return False
        except Exception as e:
            logger.error(f"Failed to connect to API: {e}")
            return False

    def stop_servers(self):
        """Stop all servers"""
        logger.info("Stopping servers...")

        if self.api_process:
            self.api_process.terminate()
            self.api_process.wait(timeout=10)
            logger.info("API server stopped")

        if self.daemon_process:
            self.daemon_process.terminate()
            self.daemon_process.wait(timeout=10)
            logger.info("Daemon stopped")

    def cleanup(self):
        """Clean up test data and close connections"""
        logger.info("Cleaning up...")

        # Delete test plans
        cursor = self.db_conn.cursor()
        for plan_id in self.test_plan_ids:
            try:
                cursor.execute("DELETE FROM completion_logs WHERE plan_id = %s", (plan_id,))
                cursor.execute("DELETE FROM tasks WHERE plan_id = %s", (plan_id,))
                cursor.execute("DELETE FROM plans WHERE id = %s", (plan_id,))
                logger.info(f"Deleted test plan: {plan_id}")
            except Exception as e:
                logger.error(f"Failed to delete plan {plan_id}: {e}")

        cursor.close()
        self.db_conn.close()

        # Stop servers
        self.stop_servers()

    def create_test_plan(self, num_tasks: int = 3) -> Optional[str]:
        """Create a test plan with specified number of tasks"""
        plan_id = f"test-plan-{int(time.time())}"

        plan_data = {
            "id": plan_id,
            "title": f"E2E Test Plan {plan_id}",
            "description": "End-to-end test plan",
            "goal": "Test completion detection",
            "status": "pending",
            "tasks": [
                {
                    "id": f"task-{i}",
                    "title": f"Task {i}",
                    "description": f"Test task {i}",
                    "status": "pending",
                    "type": "coding"
                }
                for i in range(1, num_tasks + 1)
            ]
        }

        try:
            cursor = self.db_conn.cursor()

            # Insert plan
            cursor.execute("""
                INSERT INTO plans (id, title, description, goal, status, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (plan_id, plan_data["title"], plan_data["description"],
                  plan_data["goal"], plan_data["status"],
                  datetime.now(), datetime.now()))

            # Insert tasks
            for task in plan_data["tasks"]:
                cursor.execute("""
                    INSERT INTO tasks (id, plan_id, title, description, status, type, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (task["id"], plan_id, task["title"], task["description"],
                      task["status"], task["type"], datetime.now(), datetime.now()))

            cursor.close()
            self.test_plan_ids.append(plan_id)
            logger.info(f"Created test plan: {plan_id} with {num_tasks} tasks")
            return plan_id

        except Exception as e:
            logger.error(f"Failed to create test plan: {e}")
            return None

    def add_completion_log(self, plan_id: str, content: str):
        """Add a completion log to simulate task completion"""
        try:
            cursor = self.db_conn.cursor()
            cursor.execute("""
                INSERT INTO completion_logs (plan_id, content, timestamp)
                VALUES (%s, %s, %s)
            """, (plan_id, content, datetime.now()))
            cursor.close()
            logger.info(f"Added completion log for {plan_id}: {content[:50]}...")
        except Exception as e:
            logger.error(f"Failed to add completion log: {e}")

    def get_plan_status(self, plan_id: str) -> Optional[Dict]:
        """Get current plan status from database"""
        try:
            cursor = self.db_conn.cursor()
            cursor.execute("SELECT * FROM plans WHERE id = %s", (plan_id,))
            row = cursor.fetchone()
            cursor.close()

            if row:
                columns = ['id', 'title', 'description', 'goal', 'status',
                          'created_at', 'updated_at', 'error_message', 'completed_at']
                return dict(zip(columns, row))
            return None
        except Exception as e:
            logger.error(f"Failed to get plan status: {e}")
            return None

    def get_task_statuses(self, plan_id: str) -> List[Dict]:
        """Get all task statuses for a plan"""
        try:
            cursor = self.db_conn.cursor()
            cursor.execute("SELECT * FROM tasks WHERE plan_id = %s", (plan_id,))
            rows = cursor.fetchall()
            cursor.close()

            tasks = []
            for row in rows:
                columns = ['id', 'plan_id', 'title', 'description', 'status',
                          'type', 'result', 'error', 'created_at', 'updated_at']
                tasks.append(dict(zip(columns, row)))
            return tasks
        except Exception as e:
            logger.error(f"Failed to get task statuses: {e}")
            return []

    def get_completion_log_count(self, plan_id: str) -> int:
        """Get count of completion logs for a plan"""
        try:
            cursor = self.db_conn.cursor()
            cursor.execute(
                "SELECT COUNT(*) FROM completion_logs WHERE plan_id = %s",
                (plan_id,)
            )
            count = cursor.fetchone()[0]
            cursor.close()
            return count
        except Exception as e:
            logger.error(f"Failed to get completion log count: {e}")
            return 0

    def wait_for_completion(self, plan_id: str, timeout: int = 70) -> bool:
        """Wait for plan to complete with timeout"""
        logger.info(f"Waiting for plan {plan_id} to complete (timeout: {timeout}s)...")

        start_time = time.time()
        while time.time() - start_time < timeout:
            plan = self.get_plan_status(plan_id)
            if plan and plan['status'] == 'success':
                logger.info(f"✓ Plan {plan_id} completed successfully")
                return True

            time.sleep(2)

        logger.error(f"✗ Plan {plan_id} did not complete within timeout")
        return False

    def run_test_happy_path(self) -> Dict:
        """Test 1: Happy path - complete plan execution"""
        logger.info("=" * 60)
        logger.info("TEST 1: Happy Path - Complete Plan Execution")
        logger.info("=" * 60)

        start_time = time.time()
        result = {
            "test_id": "E2E-001",
            "test_name": "Happy Path",
            "status": "pending",
            "duration": 0,
            "notes": []
        }

        try:
            # Create plan with 3 tasks
            plan_id = self.create_test_plan(3)
            if not plan_id:
                raise Exception("Failed to create test plan")

            result["notes"].append(f"Created plan {plan_id} with 3 tasks")

            # Simulate task execution with completion logs
            for i in range(1, 4):
                time.sleep(1)
                log_content = f"✔ finished — end_turn for task-{i}"
                self.add_completion_log(plan_id, log_content)
                result["notes"].append(f"Added completion log for task-{i}")

            # Wait for completion
            if self.wait_for_completion(plan_id, timeout=70):
                result["status"] = "passed"
                result["notes"].append("Plan completed successfully")

                # Verify all tasks are completed
                tasks = self.get_task_statuses(plan_id)
                completed_tasks = sum(1 for t in tasks if t['status'] == 'completed')
                if completed_tasks == 3:
                    result["notes"].append(f"All {completed_tasks} tasks marked as completed")
                else:
                    result["notes"].append(f"Warning: Only {completed_tasks}/3 tasks completed")
            else:
                result["status"] = "failed"
                result["notes"].append("Plan did not complete within timeout")

        except Exception as e:
            result["status"] = "error"
            result["notes"].append(f"Exception: {str(e)}")
            logger.error(f"Test failed: {e}")

        result["duration"] = time.time() - start_time
        self.test_results.append(result)

        logger.info(f"Test 1 completed: {result['status'].upper()}")
        return result

    def run_test_api_restart(self) -> Dict:
        """Test 2: API restart during completion"""
        logger.info("=" * 60)
        logger.info("TEST 2: API Restart During Completion")
        logger.info("=" * 60)

        start_time = time.time()
        result = {
            "test_id": "E2E-002",
            "test_name": "API Restart",
            "status": "pending",
            "duration": 0,
            "notes": []
        }

        try:
            # Create plan with 5 tasks
            plan_id = self.create_test_plan(5)
            if not plan_id:
                raise Exception("Failed to create test plan")

            result["notes"].append(f"Created plan {plan_id} with 5 tasks")

            # Execute first 3 tasks
            for i in range(1, 4):
                time.sleep(1)
                self.add_completion_log(plan_id, f"Task {i} completed")
            result["notes"].append("Executed first 3 tasks")

            # Stop API server
            logger.info("Stopping API server...")
            if self.api_process:
                self.api_process.terminate()
                self.api_process.wait(timeout=10)
            result["notes"].append("API server stopped")

            # Execute remaining tasks
            for i in range(4, 6):
                time.sleep(1)
                self.add_completion_log(plan_id, f"Task {i} completed")
            result["notes"].append("Executed remaining 2 tasks while API down")

            # Restart API server
            logger.info("Restarting API server...")
            self.api_process = subprocess.Popen(
                [sys.executable, "-m", "uvicorn", "api.app:app", "--host", "0.0.0.0", "--port", "8000"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd="/root/projects/weave"
            )
            time.sleep(5)  # Wait for API to start
            result["notes"].append("API server restarted")

            # Call manual completion check
            try:
                response = requests.post(
                    f"{self.base_url}/api/plans/{plan_id}/check-completion",
                    timeout=10
                )
                if response.status_code == 200:
                    result["notes"].append("Manual completion check successful")
                else:
                    result["notes"].append(f"Manual check returned {response.status_code}")
            except Exception as e:
                result["notes"].append(f"Manual check failed: {e}")

            # Wait for completion
            if self.wait_for_completion(plan_id, timeout=20):
                result["status"] = "passed"
                result["notes"].append("Plan completed after API restart")
            else:
                result["status"] = "failed"
                result["notes"].append("Plan did not complete after API restart")

        except Exception as e:
            result["status"] = "error"
            result["notes"].append(f"Exception: {str(e)}")
            logger.error(f"Test failed: {e}")

        result["duration"] = time.time() - start_time
        self.test_results.append(result)

        logger.info(f"Test 2 completed: {result['status'].upper()}")
        return result

    def run_test_edge_cases(self) -> Dict:
        """Test 7: Edge cases"""
        logger.info("=" * 60)
        logger.info("TEST 3: Edge Cases")
        logger.info("=" * 60)

        start_time = time.time()
        result = {
            "test_id": "E2E-007",
            "test_name": "Edge Cases",
            "status": "pending",
            "duration": 0,
            "notes": []
        }

        try:
            # Test 3.1: Plan with no tasks
            logger.info("Test 3.1: Plan with no tasks")
            plan_id = f"test-empty-{int(time.time())}"

            cursor = self.db_conn.cursor()
            cursor.execute("""
                INSERT INTO plans (id, title, description, goal, status, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (plan_id, "Empty Plan", "Plan with no tasks", "Test edge case",
                  "pending", datetime.now(), datetime.now()))
            cursor.close()
            self.test_plan_ids.append(plan_id)

            result["notes"].append("Created empty plan (no tasks)")

            # Verify plan stays in pending status
            time.sleep(5)
            plan = self.get_plan_status(plan_id)
            if plan and plan['status'] == 'pending':
                result["notes"].append("✓ Empty plan correctly remains in pending status")
            else:
                result["notes"].append("✗ Empty plan status changed unexpectedly")

            # Test 3.2: Mixed completion log patterns
            logger.info("Test 3.2: Mixed completion log patterns")
            plan_id = self.create_test_plan(5)
            if not plan_id:
                raise Exception("Failed to create test plan")

            # Add different log patterns
            patterns = [
                "✔ finished — end_turn",
                "Task completed: Task 2",
                "✓ Done with task_3",
                "Completed task_4 successfully",
                "task-5: Finished successfully"
            ]

            for pattern in patterns:
                time.sleep(1)
                self.add_completion_log(plan_id, pattern)

            result["notes"].append("Added 5 different completion log patterns")

            # Wait for completion
            if self.wait_for_completion(plan_id, timeout=70):
                result["status"] = "passed"
                result["notes"].append("✓ All log patterns detected correctly")
            else:
                result["status"] = "failed"
                result["notes"].append("✗ Not all log patterns detected")

        except Exception as e:
            result["status"] = "error"
            result["notes"].append(f"Exception: {str(e)}")
            logger.error(f"Test failed: {e}")

        result["duration"] = time.time() - start_time
        self.test_results.append(result)

        logger.info(f"Test 3 completed: {result['status'].upper()}")
        return result

    def generate_report(self) -> str:
        """Generate test report"""
        report = []
        report.append("\n" + "=" * 80)
        report.append("END-TO-END TEST RESULTS")
        report.append("=" * 80)
        report.append(f"\nTest Execution Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"Total Tests: {len(self.test_results)}")

        # Summary table
        report.append("\n" + "-" * 80)
        report.append("TEST SUMMARY")
        report.append("-" * 80)
        report.append(f"{'Test ID':<12} {'Test Name':<25} {'Status':<12} {'Duration':<10}")
        report.append("-" * 80)

        passed = 0
        failed = 0
        errors = 0

        for result in self.test_results:
            status_icon = "✓" if result['status'] == 'passed' else "✗"
            report.append(
                f"{result['test_id']:<12} {result['test_name']:<25} "
                f"{result['status']:<10} {result['duration']:.2f}s"
            )

            if result['status'] == 'passed':
                passed += 1
            elif result['status'] == 'failed':
                failed += 1
            else:
                errors += 1

        report.append("-" * 80)
        report.append(f"{'TOTAL':<12} {'':<25} {passed + failed + errors:<12}")
        report.append(f"\nResults: {passed} passed, {failed} failed, {errors} errors")

        # Detailed results
        report.append("\n" + "-" * 80)
        report.append("DETAILED RESULTS")
        report.append("-" * 80)

        for result in self.test_results:
            report.append(f"\n{result['test_id']}: {result['test_name']}")
            report.append(f"Status: {result['status'].upper()}")
            report.append(f"Duration: {result['duration']:.2f} seconds")
            report.append("Notes:")
            for note in result['notes']:
                report.append(f"  - {note}")

        report.append("\n" + "=" * 80)

        return "\n".join(report)

    def run_all_tests(self):
        """Run all end-to-end tests"""
        logger.info("\n" + "=" * 80)
        logger.info("STARTING END-TO-END TEST SUITE")
        logger.info("=" * 80 + "\n")

        # Start servers
        if not self.start_servers():
            logger.error("Failed to start servers. Exiting.")
            return

        try:
            # Run tests
            self.run_test_happy_path()
            time.sleep(2)

            self.run_test_api_restart()
            time.sleep(2)

            self.run_test_edge_cases()

        finally:
            # Generate report
            report = self.generate_report()
            print(report)

            # Save report to file
            report_path = "/root/projects/weave/E2E_TEST_RESULTS.md"
            with open(report_path, 'w') as f:
                f.write(report)

            logger.info(f"\nReport saved to: {report_path}")


def main():
    """Main entry point"""
    print("\n" + "=" * 80)
    print("END-TO-END COMPLETION DETECTION TEST SUITE")
    print("=" * 80 + "\n")

    with E2ETestRunner() as runner:
        runner.run_all_tests()

    print("\nTest suite completed!")


if __name__ == "__main__":
    main()
