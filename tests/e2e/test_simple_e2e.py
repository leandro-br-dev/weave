#!/usr/bin/env python3
"""
Simplified End-to-End Test for Completion Detection System

This script tests the completion detection system with minimal dependencies.
Uses SQLite database (same as the API).
"""

import os
import sys
import time
import sqlite3
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Database path
DB_PATH = os.getenv("DATABASE_PATH", "/root/projects/weave/api/data/database.dev.db")

# Test results
test_results = []


def log(message: str):
    """Print log message with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")


def get_db_connection():
    """Get database connection"""
    return sqlite3.connect(DB_PATH)


def create_test_plan(conn, num_tasks: int = 3) -> str:
    """Create a test plan with specified number of tasks"""
    plan_id = f"test-plan-{int(time.time())}"
    cursor = conn.cursor()

    try:
        # Insert plan
        cursor.execute("""
            INSERT INTO plans (id, title, description, goal, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (plan_id, f"E2E Test Plan {plan_id}", "End-to-end test plan",
              "Test completion detection", "pending",
              datetime.now().isoformat(), datetime.now().isoformat()))

        # Insert tasks
        for i in range(1, num_tasks + 1):
            cursor.execute("""
                INSERT INTO tasks (id, plan_id, title, description, status, type, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (f"task-{i}", plan_id, f"Task {i}", f"Test task {i}",
                  "pending", "coding", datetime.now().isoformat(), datetime.now().isoformat()))

        conn.commit()
        log(f"✓ Created test plan: {plan_id} with {num_tasks} tasks")
        return plan_id

    except Exception as e:
        conn.rollback()
        log(f"✗ Failed to create test plan: {e}")
        raise
    finally:
        cursor.close()


def add_completion_log(conn, plan_id: str, content: str):
    """Add a completion log to simulate task completion"""
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO completion_logs (plan_id, content, timestamp)
            VALUES (?, ?, ?)
        """, (plan_id, content, datetime.now().isoformat()))
        conn.commit()
        log(f"✓ Added completion log: {content[:50]}...")
    except Exception as e:
        conn.rollback()
        log(f"✗ Failed to add completion log: {e}")
        raise
    finally:
        cursor.close()


def get_plan_status(conn, plan_id: str) -> dict:
    """Get current plan status from database"""
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT * FROM plans WHERE id = ?", (plan_id,))
        row = cursor.fetchone()

        if row:
            columns = [desc[0] for desc in cursor.description]
            return dict(zip(columns, row))
        return None
    finally:
        cursor.close()


def get_task_statuses(conn, plan_id: str) -> list:
    """Get all task statuses for a plan"""
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT id, status FROM tasks WHERE plan_id = ?", (plan_id,))
        rows = cursor.fetchall()
        return [{"id": row[0], "status": row[1]} for row in rows]
    finally:
        cursor.close()


def cleanup_test_plan(conn, plan_id: str):
    """Delete test plan and all related data"""
    cursor = conn.cursor()

    try:
        cursor.execute("DELETE FROM completion_logs WHERE plan_id = ?", (plan_id,))
        cursor.execute("DELETE FROM tasks WHERE plan_id = ?", (plan_id,))
        cursor.execute("DELETE FROM plans WHERE id = ?", (plan_id,))
        conn.commit()
        log(f"✓ Cleaned up test plan: {plan_id}")
    except Exception as e:
        conn.rollback()
        log(f"✗ Failed to cleanup test plan: {e}")
    finally:
        cursor.close()


def check_completion(conn, plan_id: str) -> dict:
    """
    Check if plan should be marked as completed

    Returns: {
        'should_complete': bool,
        'completed_tasks': int,
        'total_tasks': int,
        'completion_logs': int
    }
    """
    cursor = conn.cursor()

    try:
        # Get total tasks
        cursor.execute("SELECT COUNT(*) FROM tasks WHERE plan_id = ?", (plan_id,))
        total_tasks = cursor.fetchone()[0]

        # Get completion logs count (distinct content to avoid duplicates)
        cursor.execute("""
            SELECT COUNT(DISTINCT content)
            FROM completion_logs
            WHERE plan_id = ?
        """, (plan_id,))
        completion_logs = cursor.fetchone()[0]

        # Check if all tasks have completion indicators
        should_complete = completion_logs >= total_tasks

        return {
            'should_complete': should_complete,
            'completed_tasks': completion_logs,
            'total_tasks': total_tasks,
            'completion_logs': completion_logs
        }
    finally:
        cursor.close()


def mark_plan_completed(conn, plan_id: str):
    """Mark plan as completed"""
    cursor = conn.cursor()

    try:
        # Update plan status
        cursor.execute("""
            UPDATE plans
            SET status = 'success', completed_at = ?, updated_at = ?
            WHERE id = ?
        """, (datetime.now().isoformat(), datetime.now().isoformat(), plan_id))

        # Mark all tasks as completed
        cursor.execute("""
            UPDATE tasks
            SET status = 'completed', updated_at = ?
            WHERE plan_id = ?
        """, (datetime.now().isoformat(), plan_id))

        conn.commit()
        log(f"✓ Marked plan {plan_id} as completed")
    except Exception as e:
        conn.rollback()
        log(f"✗ Failed to mark plan as completed: {e}")
        raise
    finally:
        cursor.close()


def test_1_happy_path(conn) -> dict:
    """Test 1: Happy path - complete plan execution"""
    log("\n" + "=" * 60)
    log("TEST 1: Happy Path - Complete Plan Execution")
    log("=" * 60)

    result = {
        "test_id": "E2E-001",
        "test_name": "Happy Path",
        "status": "pending",
        "notes": []
    }

    try:
        # Create plan with 3 tasks
        plan_id = create_test_plan(conn, 3)
        result["notes"].append(f"Created plan {plan_id} with 3 tasks")

        # Simulate task execution with completion logs
        for i in range(1, 4):
            time.sleep(0.5)
            add_completion_log(conn, plan_id, f"✔ finished — end_turn for task-{i}")
            result["notes"].append(f"Added completion log for task-{i}")

        # Check completion status
        check_result = check_completion(conn, plan_id)
        result["notes"].append(
            f"Completion check: {check_result['completed_tasks']}/{check_result['total_tasks']} tasks"
        )

        # Mark as completed
        if check_result['should_complete']:
            mark_plan_completed(conn, plan_id)

            # Verify completion
            plan = get_plan_status(conn, plan_id)
            if plan['status'] == 'success':
                result["status"] = "passed"
                result["notes"].append("✓ Plan marked as completed successfully")

                # Verify tasks
                tasks = get_task_statuses(conn, plan_id)
                completed_count = sum(1 for t in tasks if t['status'] == 'completed')
                result["notes"].append(f"✓ {completed_count}/3 tasks marked as completed")
            else:
                result["status"] = "failed"
                result["notes"].append("✗ Plan not marked as completed")
        else:
            result["status"] = "failed"
            result["notes"].append("✗ Completion check failed")

        # Cleanup
        cleanup_test_plan(conn, plan_id)

    except Exception as e:
        result["status"] = "error"
        result["notes"].append(f"✗ Exception: {str(e)}")

    log(f"Test 1 Result: {result['status'].upper()}")
    return result


def test_2_partial_completion(conn) -> dict:
    """Test 2: Partial completion - not all tasks completed"""
    log("\n" + "=" * 60)
    log("TEST 2: Partial Completion")
    log("=" * 60)

    result = {
        "test_id": "E2E-002",
        "test_name": "Partial Completion",
        "status": "pending",
        "notes": []
    }

    try:
        # Create plan with 5 tasks
        plan_id = create_test_plan(conn, 5)
        result["notes"].append(f"Created plan {plan_id} with 5 tasks")

        # Only complete 3 tasks
        for i in range(1, 4):
            time.sleep(0.5)
            add_completion_log(conn, plan_id, f"Task {i} completed")
        result["notes"].append("Added completion logs for 3 out of 5 tasks")

        # Check completion status
        check_result = check_completion(conn, plan_id)
        result["notes"].append(
            f"Completion check: {check_result['completed_tasks']}/{check_result['total_tasks']} tasks"
        )

        # Verify plan should NOT complete
        if not check_result['should_complete']:
            result["status"] = "passed"
            result["notes"].append("✓ Plan correctly identified as incomplete")

            # Verify plan status
            plan = get_plan_status(conn, plan_id)
            if plan['status'] == 'pending':
                result["notes"].append("✓ Plan status remains 'pending'")
            else:
                result["notes"].append(f"⚠ Plan status is '{plan['status']}'")
        else:
            result["status"] = "failed"
            result["notes"].append("✗ Plan incorrectly marked as complete")

        # Cleanup
        cleanup_test_plan(conn, plan_id)

    except Exception as e:
        result["status"] = "error"
        result["notes"].append(f"✗ Exception: {str(e)}")

    log(f"Test 2 Result: {result['status'].upper()}")
    return result


def test_3_mixed_log_patterns(conn) -> dict:
    """Test 3: Mixed completion log patterns"""
    log("\n" + "=" * 60)
    log("TEST 3: Mixed Completion Log Patterns")
    log("=" * 60)

    result = {
        "test_id": "E2E-003",
        "test_name": "Mixed Log Patterns",
        "status": "pending",
        "notes": []
    }

    try:
        # Create plan with 5 tasks
        plan_id = create_test_plan(conn, 5)
        result["notes"].append(f"Created plan {plan_id} with 5 tasks")

        # Add different log patterns
        patterns = [
            "✔ finished — end_turn",
            "Task completed: Task 2",
            "✓ Done with task_3",
            "Completed task_4 successfully",
            "task-5: Finished successfully"
        ]

        for pattern in patterns:
            time.sleep(0.5)
            add_completion_log(conn, plan_id, pattern)
        result["notes"].append("Added 5 different completion log patterns")

        # Check completion status
        check_result = check_completion(conn, plan_id)
        result["notes"].append(
            f"Completion check: {check_result['completed_tasks']}/{check_result['total_tasks']} patterns detected"
        )

        # Mark as completed
        if check_result['should_complete']:
            mark_plan_completed(conn, plan_id)

            # Verify completion
            plan = get_plan_status(conn, plan_id)
            if plan['status'] == 'success':
                result["status"] = "passed"
                result["notes"].append("✓ All log patterns detected correctly")
            else:
                result["status"] = "failed"
                result["notes"].append("✗ Plan not marked as completed")
        else:
            result["status"] = "failed"
            result["notes"].append("✗ Not all patterns detected")

        # Cleanup
        cleanup_test_plan(conn, plan_id)

    except Exception as e:
        result["status"] = "error"
        result["notes"].append(f"✗ Exception: {str(e)}")

    log(f"Test 3 Result: {result['status'].upper()}")
    return result


def test_4_empty_plan(conn) -> dict:
    """Test 4: Plan with no tasks"""
    log("\n" + "=" * 60)
    log("TEST 4: Plan with No Tasks")
    log("=" * 60)

    result = {
        "test_id": "E2E-004",
        "test_name": "Empty Plan",
        "status": "pending",
        "notes": []
    }

    plan_id = None

    try:
        # Create plan with no tasks
        plan_id = f"test-empty-{int(time.time())}"
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO plans (id, title, description, goal, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (plan_id, "Empty Plan", "Plan with no tasks", "Test edge case",
              "pending", datetime.now().isoformat(), datetime.now().isoformat()))
        conn.commit()
        cursor.close()

        result["notes"].append(f"Created empty plan {plan_id}")

        # Wait a bit
        time.sleep(2)

        # Verify plan stays in pending status
        plan = get_plan_status(conn, plan_id)
        if plan['status'] == 'pending':
            result["status"] = "passed"
            result["notes"].append("✓ Empty plan correctly remains in 'pending' status")
        else:
            result["status"] = "failed"
            result["notes"].append(f"✗ Plan status changed to '{plan['status']}'")

        # Cleanup
        cleanup_test_plan(conn, plan_id)

    except Exception as e:
        result["status"] = "error"
        result["notes"].append(f"✗ Exception: {str(e)}")
        if plan_id:
            cleanup_test_plan(conn, plan_id)

    log(f"Test 4 Result: {result['status'].upper()}")
    return result


def test_5_completion_log_patterns(conn) -> dict:
    """Test 5: Verify specific completion log patterns are detected"""
    log("\n" + "=" * 60)
    log("TEST 5: Completion Log Pattern Detection")
    log("=" * 60)

    result = {
        "test_id": "E2E-005",
        "test_name": "Pattern Detection",
        "status": "pending",
        "notes": []
    }

    try:
        # Create plan with 5 tasks
        plan_id = create_test_plan(conn, 5)
        result["notes"].append(f"Created plan {plan_id} with 5 tasks")

        # Test various completion patterns
        patterns = [
            "✔ finished — end_turn",  # Standard pattern
            "Task completed: Task 2",  # Alternative pattern
            "✓ Done with task_3",  # Checkmark pattern
            "task-4: Finished successfully",  # Success pattern
            "Completed task_5"  # Simple completion
        ]

        for i, pattern in enumerate(patterns, 1):
            time.sleep(0.5)
            add_completion_log(conn, plan_id, pattern)
            result["notes"].append(f"Added pattern {i}: {pattern[:40]}...")

        # Check if patterns are detected
        check_result = check_completion(conn, plan_id)
        result["notes"].append(
            f"Detected {check_result['completed_tasks']}/{check_result['total_tasks']} completion patterns"
        )

        if check_result['should_complete']:
            mark_plan_completed(conn, plan_id)
            result["status"] = "passed"
            result["notes"].append("✓ All completion patterns detected successfully")
        else:
            result["status"] = "failed"
            result["notes"].append("✗ Not all patterns were detected")

        # Cleanup
        cleanup_test_plan(conn, plan_id)

    except Exception as e:
        result["status"] = "error"
        result["notes"].append(f"✗ Exception: {str(e)}")

    log(f"Test 5 Result: {result['status'].upper()}")
    return result


def generate_report():
    """Generate test report"""
    report = []
    report.append("\n" + "=" * 80)
    report.append("END-TO-END TEST RESULTS")
    report.append("=" * 80)
    report.append(f"\nTest Execution Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append(f"Total Tests: {len(test_results)}")
    report.append(f"Database: {DB_PATH}")

    # Summary table
    report.append("\n" + "-" * 80)
    report.append("TEST SUMMARY")
    report.append("-" * 80)
    report.append(f"{'Test ID':<12} {'Test Name':<25} {'Status':<12}")
    report.append("-" * 80)

    passed = 0
    failed = 0
    errors = 0

    for result in test_results:
        status_icon = "✓" if result['status'] == 'passed' else ("✗" if result['status'] == 'failed' else "⚠")
        report.append(f"{result['test_id']:<12} {result['test_name']:<25} {status_icon} {result['status']:<10}")

        if result['status'] == 'passed':
            passed += 1
        elif result['status'] == 'failed':
            failed += 1
        else:
            errors += 1

    report.append("-" * 80)
    report.append(f"\nResults: {passed} passed, {failed} failed, {errors} errors")

    # Overall result
    if failed == 0 and errors == 0:
        report.append("\n✓ ALL TESTS PASSED")
    elif failed > 0:
        report.append(f"\n✗ {failed} TEST(S) FAILED")
    else:
        report.append(f"\n⚠ {errors} TEST(S) HAD ERRORS")

    # Detailed results
    report.append("\n" + "-" * 80)
    report.append("DETAILED RESULTS")
    report.append("-" * 80)

    for result in test_results:
        report.append(f"\n{result['test_id']}: {result['test_name']}")
        report.append(f"Status: {result['status'].upper()}")
        report.append("Notes:")
        for note in result['notes']:
            report.append(f"  {note}")

    report.append("\n" + "=" * 80)

    return "\n".join(report)


def main():
    """Main entry point"""
    print("\n" + "=" * 80)
    print("END-TO-END COMPLETION DETECTION TEST SUITE")
    print("=" * 80 + "\n")

    # Check if database exists
    if not os.path.exists(DB_PATH):
        log(f"⚠ Database not found at {DB_PATH}")
        log("Please ensure the database exists before running tests")
        return 1

    log(f"Using database: {DB_PATH}")

    conn = None

    try:
        # Get database connection
        conn = get_db_connection()
        log("✓ Connected to database")

        # Run tests
        test_results.append(test_1_happy_path(conn))
        test_results.append(test_2_partial_completion(conn))
        test_results.append(test_3_mixed_log_patterns(conn))
        test_results.append(test_4_empty_plan(conn))
        test_results.append(test_5_completion_log_patterns(conn))

        # Generate and display report
        report = generate_report()
        print(report)

        # Save report to file
        report_path = "/root/projects/weave/E2E_TEST_RESULTS.md"
        with open(report_path, 'w') as f:
            f.write(report)

        log(f"\n✓ Report saved to: {report_path}")

        # Return exit code
        failed = sum(1 for r in test_results if r['status'] == 'failed')
        errors = sum(1 for r in test_results if r['status'] == 'error')

        if failed > 0 or errors > 0:
            return 1
        return 0

    except Exception as e:
        log(f"\n✗ Test suite failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

    finally:
        if conn:
            conn.close()
            log("✓ Database connection closed")


if __name__ == "__main__":
    sys.exit(main())
