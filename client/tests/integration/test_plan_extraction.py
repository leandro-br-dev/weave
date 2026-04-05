#!/usr/bin/env python3
"""Teste unitário para a função load_plan_from_file (Blackboard pattern)."""

import json
import sys
import tempfile
from pathlib import Path

# Add parent directories to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from orchestrator.kanban_pipeline import load_plan_from_file


def test_load_plan_valid():
    """Testa carregamento de plano válido a partir de arquivo."""
    print("=" * 80)
    print("TEST: load_plan_from_file with valid plan")
    print("=" * 80)

    plan_data = {
        "name": "Fix Authentication Flow",
        "summary": "Fix the auth flow",
        "tasks": [
            {
                "id": "task-1",
                "name": "Fix auth middleware",
                "prompt": "Fix the auth middleware",
                "cwd": "/root/test",
                "workspace": "/root/test/workspace",
                "tools": ["Read"],
                "permission_mode": "acceptEdits",
                "depends_on": []
            }
        ]
    }

    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(plan_data, f)
        f.flush()
        plan = load_plan_from_file(f.name)

    assert plan is not None, "Plan should be loaded from file"
    assert plan.get("name") == "Fix Authentication Flow", f"Wrong plan name: {plan.get('name')}"
    assert len(plan.get("tasks", [])) == 1, f"Expected 1 task, got {len(plan.get('tasks', []))}"
    assert plan.get("tasks")[0]["id"] == "task-1", "Wrong task ID"

    print("✅ Test 1 PASSED: Load valid plan from file")
    print(f"   • Plan name: {plan.get('name')}")
    print(f"   • Tasks: {len(plan.get('tasks', []))}")


def test_load_plan_missing_file():
    """Testa quando arquivo não existe."""
    print("\n" + "=" * 80)
    print("TEST: load_plan_from_file with missing file")
    print("=" * 80)

    plan = load_plan_from_file("/tmp/nonexistent_plan_file_12345.json")

    assert plan is None, "Should return None when file not found"

    print("✅ Test 2 PASSED: Return None when file not found")


def test_load_plan_empty_file():
    """Testa quando arquivo existe mas está vazio."""
    print("\n" + "=" * 80)
    print("TEST: load_plan_from_file with empty file")
    print("=" * 80)

    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        f.write("")
        f.flush()
        plan = load_plan_from_file(f.name)

    assert plan is None, "Should return None for empty file"

    print("✅ Test 3 PASSED: Return None for empty file")


def test_load_plan_invalid_json():
    """Testa quando arquivo contém JSON inválido."""
    print("\n" + "=" * 80)
    print("TEST: load_plan_from_file with invalid JSON")
    print("=" * 80)

    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        f.write("{ invalid json }")
        f.flush()
        plan = load_plan_from_file(f.name)

    assert plan is None, "Should return None for invalid JSON"

    print("✅ Test 4 PASSED: Return None for invalid JSON")


def test_load_plan_with_fallback_name():
    """Testa uso de fallback_name quando plano não tem nome."""
    print("\n" + "=" * 80)
    print("TEST: load_plan_from_file with fallback name")
    print("=" * 80)

    plan_data = {
        "summary": "Plan without name",
        "tasks": [
            {
                "id": "task-1",
                "name": "Task",
                "prompt": "Do it",
                "cwd": "/root/test",
                "workspace": "/root/test/workspace",
                "tools": ["Read"],
                "permission_mode": "acceptEdits",
                "depends_on": []
            }
        ]
    }

    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(plan_data, f)
        f.flush()
        plan = load_plan_from_file(f.name, fallback_name="Fallback Name")

    assert plan is not None, "Plan should be loaded"
    assert plan.get("name") == "Fallback Name", f"Should use fallback name, got: {plan.get('name')}"

    print("✅ Test 5 PASSED: Use fallback name when plan has no name")
    print(f"   • Plan name: {plan.get('name')}")


def test_load_plan_skip_template():
    """Testa que planos template são ignorados."""
    print("\n" + "=" * 80)
    print("TEST: load_plan_from_file skip template placeholder")
    print("=" * 80)

    plan_data = {
        "name": "Descriptive plan name",
        "summary": "This is a template",
        "tasks": []
    }

    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(plan_data, f)
        f.flush()
        plan = load_plan_from_file(f.name)

    assert plan is None, "Template placeholder should be skipped"

    print("✅ Test 6 PASSED: Skip template placeholder plans")


def test_load_plan_skip_empty_tasks():
    """Testa que planos sem tarefas são ignorados."""
    print("\n" + "=" * 80)
    print("TEST: load_plan_from_file skip plans with no tasks")
    print("=" * 80)

    plan_data = {
        "name": "Plan Without Tasks",
        "summary": "This plan has no tasks",
        "tasks": []
    }

    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(plan_data, f)
        f.flush()
        plan = load_plan_from_file(f.name)

    assert plan is None, "Plans with empty tasks should be skipped"

    print("✅ Test 7 PASSED: Skip plans with no tasks")


def test_load_plan_multiple_tasks():
    """Testa carregamento de plano com múltiplas tasks."""
    print("\n" + "=" * 80)
    print("TEST: load_plan_from_file with multiple tasks")
    print("=" * 80)

    plan_data = {
        "name": "Multi-Task Plan",
        "summary": "Plan with dependencies",
        "tasks": [
            {
                "id": "task-1",
                "name": "First Task",
                "prompt": "Do first",
                "cwd": "/root/test",
                "workspace": "/root/test/workspace",
                "tools": ["Read"],
                "permission_mode": "acceptEdits",
                "depends_on": []
            },
            {
                "id": "task-2",
                "name": "Second Task",
                "prompt": "Do second",
                "cwd": "/root/test",
                "workspace": "/root/test/workspace",
                "tools": ["Read"],
                "permission_mode": "acceptEdits",
                "depends_on": ["task-1"]
            }
        ]
    }

    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(plan_data, f)
        f.flush()
        plan = load_plan_from_file(f.name)

    assert plan is not None, "Plan should be loaded"
    assert len(plan.get("tasks", [])) == 2, f"Expected 2 tasks, got {len(plan.get('tasks', []))}"
    assert plan.get("tasks")[1]["depends_on"] == ["task-1"], "Dependencies should be preserved"

    print("✅ Test 8 PASSED: Load multi-task plan with dependencies")
    print(f"   • Plan name: {plan.get('name')}")
    print(f"   • Tasks: {len(plan.get('tasks', []))}")


def main():
    """Executa todos os testes."""
    print("\n" + "=" * 80)
    print("UNIT TESTS: load_plan_from_file() (Blackboard pattern)")
    print("=" * 80)

    tests = [
        test_load_plan_valid,
        test_load_plan_missing_file,
        test_load_plan_empty_file,
        test_load_plan_invalid_json,
        test_load_plan_with_fallback_name,
        test_load_plan_skip_template,
        test_load_plan_skip_empty_tasks,
        test_load_plan_multiple_tasks,
    ]

    passed = 0
    failed = 0

    for test_func in tests:
        try:
            test_func()
            passed += 1
        except AssertionError as e:
            print(f"\n❌ {test_func.__name__} FAILED: {e}")
            failed += 1
        except Exception as e:
            print(f"\n❌ {test_func.__name__} ERROR: {type(e).__name__}: {e}")
            failed += 1

    print("\n" + "=" * 80)
    print(f"RESULTS: {passed} passed, {failed} failed")
    print("=" * 80)

    if failed == 0:
        print("✅ ALL TESTS PASSED!")
        return 0
    else:
        print(f"❌ {failed} TEST(S) FAILED")
        return 1


if __name__ == '__main__':
    sys.exit(main())
