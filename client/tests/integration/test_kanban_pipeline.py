#!/usr/bin/env python3
"""
Test suite for kanban pipeline functionality.

Run with: python test_kanban_pipeline.py
"""

import asyncio
import json
import sys
from pathlib import Path
import pytest

# Add parent directories to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from orchestrator.kanban_pipeline import (
    load_plan_from_file,
    find_planner_workspace,
    process_kanban_task,
    poll_kanban_tasks,
    _running_kanban_tasks,
)
from orchestrator.daemon_client import DaemonClient
from orchestrator import logger


def test_load_plan_from_file():
    """Test loading plan from a file (Blackboard pattern)."""
    logger.header("Testing load_plan_from_file")

    import tempfile

    # Valid plan
    plan_data = {"name": "Test Plan", "tasks": [{"id": "t1", "name": "Task 1", "prompt": "Do task 1", "cwd": "/root/test", "workspace": "/root/test/ws"}]}
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(plan_data, f)
        f.flush()
        result1 = load_plan_from_file(f.name)
    assert result1 is not None, "Should load valid plan"
    assert result1["name"] == "Test Plan", "Should have correct name"
    assert len(result1["tasks"]) == 1, "Should have one task"
    logger.success("✓ Valid plan loading")

    # Missing file
    result2 = load_plan_from_file("/tmp/nonexistent_plan_file_test.json")
    assert result2 is None, "Should return None for missing file"
    logger.success("✓ Missing file handling")

    # Invalid JSON
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        f.write("not json")
        f.flush()
        result3 = load_plan_from_file(f.name)
    assert result3 is None, "Should reject invalid JSON"
    logger.success("✓ Invalid JSON rejection")

    # Empty tasks
    empty_plan = {"name": "Empty", "tasks": []}
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(empty_plan, f)
        f.flush()
        result4 = load_plan_from_file(f.name)
    assert result4 is None, "Should reject empty tasks list"
    logger.success("✓ Empty tasks rejection")

    # Placeholder name
    template_plan = {"name": "Descriptive plan name", "tasks": [{"id": "t1", "name": "T", "prompt": "p", "cwd": "/root", "workspace": "/root/ws"}]}
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(template_plan, f)
        f.flush()
        result5 = load_plan_from_file(f.name)
    assert result5 is None, "Should reject placeholder name"
    logger.success("✓ Placeholder name rejection")

    # Fallback name
    no_name_plan = {"tasks": [{"id": "t1", "name": "T", "prompt": "p", "cwd": "/root", "workspace": "/root/ws"}]}
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(no_name_plan, f)
        f.flush()
        result6 = load_plan_from_file(f.name, fallback_name="Fallback")
    assert result6 is not None, "Should use fallback name"
    assert result6["name"] == "Fallback", "Should have fallback name"
    logger.success("✓ Fallback name handling")

    logger.plan_done("load_plan_from_file", success=True)


@pytest.mark.asyncio
async def test_daemon_client_methods():
    """Test DaemonClient kanban pipeline methods."""
    logger.header("Testing DaemonClient Methods")

    # Create a mock client (won't make real API calls)
    client = DaemonClient("http://localhost:3001", "test_token")

    # Check methods exist
    methods = [
        "get_pending_kanban_tasks",
        "get_all_projects",
        "update_kanban_pipeline",
        "create_plan_from_data",
        "prepare_workflow",
        "start_plan_async",
        "_patch",
        "_post",
        "_get",
    ]

    for method_name in methods:
        assert hasattr(client, method_name), f"Missing method: {method_name}"
        logger.success(f"✓ Method exists: {method_name}")

    # Test that async methods are coroutines
    import inspect

    async_methods = [
        "get_pending_kanban_tasks",
        "get_all_projects",
        "update_kanban_pipeline",
        "create_plan_from_data",
        "prepare_workflow",
        "start_plan_async",
    ]

    for method_name in async_methods:
        method = getattr(client, method_name)
        assert inspect.iscoroutinefunction(method), f"{method_name} should be async"
        logger.success(f"✓ Method is async: {method_name}")

    logger.plan_done("DaemonClient methods", success=True)


@pytest.mark.asyncio
async def test_error_handling():
    """Test error handling in kanban pipeline."""
    logger.header("Testing Error Handling")

    import tempfile

    # Test load_plan_from_file with malformed input files
    test_cases = [
        ("missing file", "/tmp/nonexistent_test_file_123.json"),
        ("empty file", None),  # will create temp
        ("invalid JSON", None),  # will create temp
    ]

    for test_name, test_path in test_cases:
        try:
            if test_name == "empty file":
                with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                    f.write("")
                    f.flush()
                    result = load_plan_from_file(f.name)
            elif test_name == "invalid JSON":
                with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                    f.write("{bad json}")
                    f.flush()
                    result = load_plan_from_file(f.name)
            else:
                result = load_plan_from_file(test_path)
            # Should return None, not raise exception
            assert result is None or isinstance(result, dict), "Should handle gracefully"
            logger.success(f"✓ Handled: {test_name}")
        except Exception as e:
            logger.error(f"✗ Failed on {test_name}: {e}")
            raise

    logger.plan_done("Error handling", success=True)


@pytest.mark.asyncio
async def test_running_tasks_tracking():
    """Test that running tasks are tracked correctly."""
    logger.header("Testing Running Tasks Tracking")

    # Check initial state
    initial_count = len(_running_kanban_tasks)
    logger.info(f"Initial running tasks: {initial_count}")

    # Simulate adding a task
    test_task_id = "test-task-123"
    _running_kanban_tasks.add(test_task_id)
    assert test_task_id in _running_kanban_tasks, "Task should be tracked"
    logger.success("✓ Task added to tracking set")

    # Simulate removing a task
    _running_kanban_tasks.discard(test_task_id)
    assert test_task_id not in _running_kanban_tasks, "Task should be removed"
    logger.success("✓ Task removed from tracking set")

    # Discard should be safe for non-existent tasks
    _running_kanban_tasks.discard("non-existent")
    logger.success("✓ Discard non-existent task is safe")

    logger.plan_done("Running tasks tracking", success=True)


async def run_all_tests():
    """Run all tests."""
    logger.header("Kanban Pipeline Test Suite")

    tests = [
        ("Plan File Loading", test_load_plan_from_file),
        ("DaemonClient Methods", test_daemon_client_methods),
        ("Error Handling", test_error_handling),
        ("Running Tasks Tracking", test_running_tasks_tracking),
    ]

    passed = 0
    failed = 0

    for test_name, test_func in tests:
        try:
            if asyncio.iscoroutinefunction(test_func):
                await test_func()
            else:
                test_func()
            passed += 1
        except Exception as e:
            failed += 1
            logger.error(f"Test '{test_name}' failed: {e}")

    # Summary
    logger.header(f"Test Results: {passed} passed, {failed} failed")
    if failed == 0:
        logger.success("✓ All tests passed!")
    else:
        logger.error(f"✗ {failed} test(s) failed")

    return failed == 0


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    exit(0 if success else 1)
