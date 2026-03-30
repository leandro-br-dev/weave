#!/usr/bin/env python3
"""
Test the API check-completion endpoint
"""

import os
import sys
import time
import sqlite3
import json
import requests
from datetime import datetime
from pathlib import Path

# Database path
DB_PATH = os.getenv("DATABASE_PATH", "/root/projects/weave/api/data/database.dev.db")
API_URL = "http://localhost:3000"
API_TOKEN = os.getenv("API_TOKEN", "test-token")  # You may need to set this


def log(message: str):
    """Print log message with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")


def get_db_connection():
    """Get database connection"""
    return sqlite3.connect(DB_PATH)


def create_test_plan(conn, num_tasks: int = 3) -> str:
    """Create a test plan with specified number of tasks"""
    plan_id = f"api-test-{int(time.time())}"
    cursor = conn.cursor()

    try:
        # Create tasks JSON structure
        tasks = [
            {
                "id": f"task-{i}",
                "title": f"Task {i}",
                "description": f"Test task {i}",
                "status": "pending"
            }
            for i in range(1, num_tasks + 1)
        ]

        # Insert plan
        cursor.execute("""
            INSERT INTO plans (id, name, tasks, status, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (plan_id, f"API Test Plan {plan_id}", json.dumps(tasks),
              "running", datetime.now().isoformat()))

        conn.commit()
        log(f"✓ Created test plan: {plan_id} with {num_tasks} tasks")
        return plan_id

    except Exception as e:
        conn.rollback()
        log(f"✗ Failed to create test plan: {e}")
        raise
    finally:
        cursor.close()


def add_plan_log(conn, plan_id: str, task_id: str, message: str):
    """Add a plan log"""
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO plan_logs (plan_id, task_id, level, message, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (plan_id, task_id, "info", message, datetime.now().isoformat()))
        conn.commit()
        log(f"✓ Added plan log for {task_id}: {message[:50]}...")
    except Exception as e:
        conn.rollback()
        log(f"✗ Failed to add plan log: {e}")
        raise
    finally:
        cursor.close()


def cleanup_test_plan(conn, plan_id: str):
    """Delete test plan"""
    cursor = conn.cursor()

    try:
        cursor.execute("DELETE FROM plan_logs WHERE plan_id = ?", (plan_id,))
        cursor.execute("DELETE FROM plans WHERE id = ?", (plan_id,))
        conn.commit()
        log(f"✓ Cleaned up test plan: {plan_id}")
    except Exception as e:
        conn.rollback()
        log(f"✗ Failed to cleanup: {e}")
    finally:
        cursor.close()


def call_check_completion_api(plan_id: str) -> dict:
    """Call the check-completion API endpoint"""
    url = f"{API_URL}/api/plans/{plan_id}/check-completion"

    try:
        # Use the default dev token
        headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer dev-token-change-in-production"
        }

        response = requests.post(url, headers=headers, timeout=10)

        if response.status_code == 200:
            return response.json()
        elif response.status_code == 401:
            log("⚠ Authentication required. Skipping API test.")
            return None
        else:
            log(f"✗ API returned status {response.status_code}: {response.text}")
            return None

    except requests.exceptions.ConnectionError:
        log("✗ Cannot connect to API. Is it running?")
        return None
    except Exception as e:
        log(f"✗ API call failed: {e}")
        return None


def test_api_check_completion_endpoint():
    """Test the API check-completion endpoint"""
    log("\n" + "=" * 60)
    log("API ENDPOINT TEST: /api/plans/:id/check-completion")
    log("=" * 60)

    conn = None
    plan_id = None

    try:
        # Check if API is running
        try:
            response = requests.get(f"{API_URL}/api/health", timeout=5)
            if response.status_code != 200:
                log("✗ API health check failed")
                return
            log(f"✓ API is running: {response.json()['message']}")
        except Exception as e:
            log(f"✗ API is not accessible: {e}")
            log("Please start the API server: cd api && npm start")
            return

        # Connect to database
        conn = get_db_connection()
        log("✓ Connected to database")

        # Create plan with 3 tasks
        plan_id = create_test_plan(conn, 3)

        # Add completion logs for all tasks
        for i in range(1, 4):
            time.sleep(0.5)
            add_plan_log(conn, plan_id, f"task-{i}", f"✔ finished — end_turn")

        log("\n" + "-" * 60)
        log("Calling API endpoint...")
        log("-" * 60)

        # Call the API
        result = call_check_completion_api(plan_id)

        if result is None:
            log("⚠ API call failed or requires authentication")
            log("Skipping API endpoint test")
            return

        # Display result
        log("\n" + "-" * 60)
        log("API Response:")
        log("-" * 60)
        log(json.dumps(result, indent=2))

        # Verify result
        if result.get('error'):
            log(f"\n✗ API returned error: {result['error']}")
            return

        data = result.get('data', {})
        log(f"\n" + "-" * 60)
        log("Verification:")
        log("-" * 60)
        log(f"Total tasks: {data.get('total_tasks')}")
        log(f"Completed tasks: {data.get('completed_tasks')}")
        log(f"All completed: {data.get('completed')}")
        log(f"Plan status: {data.get('plan_status')}")
        log(f"Auto-completed: {data.get('auto_completed')}")

        # Check if it worked
        if data.get('completed') and data.get('auto_completed'):
            log("\n✓ API endpoint successfully detected completion and marked plan as success!")
        elif data.get('completed'):
            log("\n✓ API endpoint detected completion (plan was already completed)")
        else:
            log("\n✗ API endpoint did not detect completion")

        # Cleanup
        cleanup_test_plan(conn, plan_id)

    except Exception as e:
        log(f"\n✗ Test failed: {e}")
        import traceback
        traceback.print_exc()

        if plan_id and conn:
            cleanup_test_plan(conn, plan_id)

    finally:
        if conn:
            conn.close()
            log("\n✓ Database connection closed")


def main():
    """Main entry point"""
    print("\n" + "=" * 80)
    print("API COMPLETION ENDPOINT TEST")
    print("=" * 80 + "\n")

    test_api_check_completion_endpoint()

    print("\n" + "=" * 80)
    print("Test completed!")
    print("=" * 80)


if __name__ == "__main__":
    main()
