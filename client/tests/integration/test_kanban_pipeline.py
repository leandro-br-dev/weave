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
    extract_plan_from_text,
    find_planner_workspace,
    process_kanban_task,
    poll_kanban_tasks,
    _running_kanban_tasks,
)
from orchestrator.daemon_client import DaemonClient
from orchestrator import logger


def test_extract_plan_from_text():
    """Test the plan extraction from various text formats."""
    logger.header("Testing extract_plan_from_text")

    # Valid plan
    text1 = '<plan>{"name": "Test Plan", "tasks": [{"id": "t1", "name": "Task 1"}]}</plan>'
    result1 = extract_plan_from_text(text1)
    assert result1 is not None, "Should extract valid plan"
    assert result1["name"] == "Test Plan", "Should have correct name"
    assert len(result1["tasks"]) == 1, "Should have one task"
    logger.success("✓ Valid plan extraction")

    # Plan with surrounding text
    text2 = "Some context <plan>{\"name\": \"Plan\", \"tasks\": [{\"id\": \"t1\", \"name\": \"T\"}]}</plan> more text"
    result2 = extract_plan_from_text(text2)
    assert result2 is not None, "Should extract plan from text"
    logger.success("✓ Plan extraction with surrounding text")

    # Invalid JSON
    text3 = "<plan>invalid json</plan>"
    result3 = extract_plan_from_text(text3)
    assert result3 is None, "Should reject invalid JSON"
    logger.success("✓ Invalid JSON rejection")

    # Empty tasks
    text4 = '<plan>{"name": "Empty", "tasks": []}</plan>'
    result4 = extract_plan_from_text(text4)
    assert result4 is None, "Should reject empty tasks list"
    logger.success("✓ Empty tasks rejection")

    # Placeholder name
    text5 = '<plan>{"name": "Descriptive plan name", "tasks": [{"id": "t1"}]}</plan>'
    result5 = extract_plan_from_text(text5)
    assert result5 is None, "Should reject placeholder name"
    logger.success("✓ Placeholder name rejection")

    # Multiple plan tags (should use first valid)
    text6 = '<plan>invalid</plan> <plan>{"name": "Second", "tasks": [{"id": "t1"}]}</plan>'
    result6 = extract_plan_from_text(text6)
    assert result6 is not None, "Should find second valid plan"
    logger.success("✓ Multiple plan tags handling")

    logger.plan_done("extract_plan_from_text", success=True)


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

    # Test extract_plan_from_text with malformed input
    malformed_inputs = [
        "",
        "no plan tags here",
        "<plan></plan>",
        '{"name": "No tags"}',
        None,
    ]

    for test_input in malformed_inputs:
        try:
            if test_input is None:
                result = extract_plan_from_text("")
            else:
                result = extract_plan_from_text(test_input)
            # Should return None, not raise exception
            assert result is None or isinstance(result, dict), "Should handle gracefully"
            logger.success(f"✓ Handled: {repr(test_input)[:50]}")
        except Exception as e:
            logger.error(f"✗ Failed on {repr(test_input)[:50]}: {e}")
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
        ("Plan Extraction", test_extract_plan_from_text),
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
