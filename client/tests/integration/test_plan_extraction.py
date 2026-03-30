#!/usr/bin/env python3
"""Teste unitário para a função extract_plan_from_text."""

import sys
from pathlib import Path

# Add parent directories to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from orchestrator.kanban_pipeline import extract_plan_from_text


def test_extract_plan_with_descriptive_text():
    """Testa extração quando há texto descritivo antes do bloco <plan>."""
    print("=" * 80)
    print("TEST: extract_plan_from_text with descriptive text")
    print("=" * 80)

    # Caso real do log - texto descritivo antes do plano
    response_with_text = """I'll analyze the codebase to understand the current implementation and identify the issues with the "Improve with AI" feature.Now let me see the rest of the function and understand the flow:Now let me check the backend API that handles the improvement:Now let me check how the agents execute the plan and save the structured output:Let me check the daemon that executes plans:Let me check the Python client that executes the plans:Let me search for where the structured output is saved:Now let me check the client that saves the structured output:Now I understand the issue! Looking at the code, I can see:

1. The `extract_structured_output` function in `runner.py` only looks for patterns: `<plan>`, `<review>`, and `<diagnosis>` tags
2. The improvement task is looking for a JSON block with `{"improvedContent": "..."}` which is NOT being captured by the structured output extraction
3. The planner agent's CLAUDE.md tells the agent to save the structured output via curl, but the agent is NOT actually doing that - it's just outputting the JSON

Let me verify this by checking what patterns are being searched:Perfect! Now I understand the complete problem. Let me create a comprehensive plan to fix this issue:

<plan>
{
  "name": "Fix CLAUDE.md Improvement with AI Feature",
  "summary": "The 'Improve with AI' feature is timing out because the planner agent outputs improved content as a JSON block, but the runner only extracts structured output wrapped in <plan>, <review>, or <diagnosis> tags. We need to add a new pattern for CLAUDE.md improvement output and ensure the improved content is properly extracted and saved to the plan's structured_output field.",
  "tasks": [
    {
      "id": "add-improvement-pattern",
      "name": "Add improvement pattern to structured output extraction",
      "prompt": "Add a new structured output pattern for CLAUDE.md improvements.",
      "cwd": "/root/projects/weave",
      "workspace": "/root/projects/weave/projects/weave/agents/coder-backend",
      "tools": ["Read", "Write", "Edit", "Bash", "Glob"],
      "permission_mode": "acceptEdits",
      "depends_on": []
    }
  ]
}
</plan>"""

    plan = extract_plan_from_text(response_with_text, fallback_name="Test Plan")

    assert plan is not None, "Plan should be extracted from text with descriptive content"
    assert plan.get("name") == "Fix CLAUDE.md Improvement with AI Feature", f"Wrong plan name: {plan.get('name')}"
    assert len(plan.get("tasks", [])) == 1, f"Expected 1 task, got {len(plan.get('tasks', []))}"
    assert plan.get("tasks")[0]["id"] == "add-improvement-pattern", "Wrong task ID"

    print("✅ Test 1 PASSED: Extract plan with descriptive text before <plan>")
    print(f"   • Plan name: {plan.get('name')}")
    print(f"   • Tasks: {len(plan.get('tasks', []))}")


def test_extract_plan_with_duplicates():
    """Testa extração quando há blocos <plan> duplicados."""
    print("\n" + "=" * 80)
    print("TEST: extract_plan_from_text with duplicate <plan> blocks")
    print("=" * 80)

    # Resposta com plano duplicado
    response_with_duplicates = """I'll analyze the codebase to understand the current implementation.

<plan>
{
  "name": "First Plan",
  "summary": "This is the first plan",
  "tasks": [
    {
      "id": "task-1",
      "name": "Task 1",
      "prompt": "Do task 1",
      "cwd": "/root/test",
      "workspace": "/root/test/workspace",
      "tools": ["Read"],
      "permission_mode": "acceptEdits",
      "depends_on": []
    }
  ]
}
</plan>Perfect! Now I understand the complete problem. Let me create a comprehensive plan to fix this issue:

<plan>
{
  "name": "Second Plan",
  "summary": "This is the second plan",
  "tasks": [
    {
      "id": "task-2",
      "name": "Task 2",
      "prompt": "Do task 2",
      "cwd": "/root/test",
      "workspace": "/root/test/workspace",
      "tools": ["Read"],
      "permission_mode": "acceptEdits",
      "depends_on": []
    }
  ]
}
</plan>"""

    plan = extract_plan_from_text(response_with_duplicates)

    assert plan is not None, "Plan should be extracted even with duplicates"
    assert plan.get("name") == "First Plan", "Should extract the first valid plan"
    assert len(plan.get("tasks", [])) == 1, f"Expected 1 task, got {len(plan.get('tasks', []))}"

    print("✅ Test 2 PASSED: Extract first valid plan from duplicates")
    print(f"   • Plan name: {plan.get('name')}")


def test_extract_plan_with_code_fences():
    """Testa extração quando o plano está dentro de code fences."""
    print("\n" + "=" * 80)
    print("TEST: extract_plan_from_text with code fences")
    print("=" * 80)

    response_with_fences = """Here's my plan:

```
<plan>
{
  "name": "Plan in Code Fences",
  "summary": "Plan wrapped in code fences",
  "tasks": [
    {
      "id": "task-1",
      "name": "Task in Fences",
      "prompt": "Do something",
      "cwd": "/root/test",
      "workspace": "/root/test/workspace",
      "tools": ["Read"],
      "permission_mode": "acceptEdits",
      "depends_on": []
    }
  ]
}
</plan>
```

That's the complete plan."""

    plan = extract_plan_from_text(response_with_fences)

    assert plan is not None, "Plan should be extracted from code fences"
    assert plan.get("name") == "Plan in Code Fences"

    print("✅ Test 3 PASSED: Extract plan from code fences")
    print(f"   • Plan name: {plan.get('name')}")


def test_extract_plan_minimal():
    """Testa extração de plano mínimo sem texto descritivo."""
    print("\n" + "=" * 80)
    print("TEST: extract_plan_from_text minimal case")
    print("=" * 80)

    minimal_response = """<plan>
{
  "name": "Minimal Plan",
  "summary": "A minimal plan",
  "tasks": [
    {
      "id": "task-1",
      "name": "Single Task",
      "prompt": "Do something",
      "cwd": "/root/test",
      "workspace": "/root/test/workspace",
      "tools": ["Read"],
      "permission_mode": "acceptEdits",
      "depends_on": []
    }
  ]
}
</plan>"""

    plan = extract_plan_from_text(minimal_response)

    assert plan is not None, "Plan should be extracted from minimal response"
    assert plan.get("name") == "Minimal Plan"
    assert len(plan.get("tasks", [])) == 1

    print("✅ Test 4 PASSED: Extract minimal plan")
    print(f"   • Plan name: {plan.get('name')}")
    print(f"   • Tasks: {len(plan.get('tasks', []))}")


def test_extract_plan_no_valid_plan():
    """Testa quando não há plano válido."""
    print("\n" + "=" * 80)
    print("TEST: extract_plan_from_text with no valid plan")
    print("=" * 80)

    no_plan_response = """This is just some text without any plan blocks.
It might mention JSON or other things but no <plan> tags."""

    plan = extract_plan_from_text(no_plan_response)

    assert plan is None, "Should return None when no valid plan found"

    print("✅ Test 5 PASSED: Return None when no valid plan")


def test_extract_plan_with_fallback_name():
    """Testa uso de fallback_name quando plano não tem nome."""
    print("\n" + "=" * 80)
    print("TEST: extract_plan_from_text with fallback name")
    print("=" * 80)

    no_name_response = """<plan>
{
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
</plan>"""

    plan = extract_plan_from_text(no_name_response, fallback_name="Fallback Name")

    assert plan is not None, "Plan should be extracted"
    assert plan.get("name") == "Fallback Name", f"Should use fallback name, got: {plan.get('name')}"

    print("✅ Test 6 PASSED: Use fallback name when plan has no name")
    print(f"   • Plan name: {plan.get('name')}")


def test_extract_plan_skip_template():
    """Testa que planos template são ignorados."""
    print("\n" + "=" * 80)
    print("TEST: extract_plan_from_text skip template placeholder")
    print("=" * 80)

    template_response = """<plan>
{
  "name": "Descriptive plan name",
  "summary": "This is a template",
  "tasks": []
}
</plan>"""

    plan = extract_plan_from_text(template_response)

    assert plan is None, "Template placeholder should be skipped"

    print("✅ Test 7 PASSED: Skip template placeholder plans")


def test_extract_plan_skip_empty_tasks():
    """Testa que planos sem tarefas são ignorados."""
    print("\n" + "=" * 80)
    print("TEST: extract_plan_from_text skip plans with no tasks")
    print("=" * 80)

    empty_tasks_response = """<plan>
{
  "name": "Plan Without Tasks",
  "summary": "This plan has no tasks",
  "tasks": []
}
</plan>"""

    plan = extract_plan_from_text(empty_tasks_response)

    assert plan is None, "Plans with empty tasks should be skipped"

    print("✅ Test 8 PASSED: Skip plans with no tasks")


def main():
    """Executa todos os testes."""
    print("\n" + "=" * 80)
    print("UNIT TESTS: extract_plan_from_text()")
    print("=" * 80)

    tests = [
        test_extract_plan_with_descriptive_text,
        test_extract_plan_with_duplicates,
        test_extract_plan_with_code_fences,
        test_extract_plan_minimal,
        test_extract_plan_no_valid_plan,
        test_extract_plan_with_fallback_name,
        test_extract_plan_skip_template,
        test_extract_plan_skip_empty_tasks,
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
