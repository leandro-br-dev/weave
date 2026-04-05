#!/usr/bin/env python3
"""
Test script to verify structured output extraction works correctly
"""
import sys
import json
import re

# Add client directory to path
sys.path.insert(0, '/root/projects/weave/client')

from orchestrator.runner import extract_structured_output


def test_plan_json_block():
    """Test extraction of plan content from <plan> JSON blocks"""
    test_cases = [
        {
            "name": "Simple plan JSON block",
            "text": """
Here's my analysis.

<plan>
{"name": "Test Plan", "tasks": [{"id": "1", "name": "task1"}]}
</plan>

Let me know if you need any changes!
""",
            "expected_type": "plan",
        },
        {
            "name": "Multiple plan blocks - should use last one",
            "text": """
Here's an example format:

<plan>
{"name": "Example", "tasks": []}
</plan>

Now here's the actual response:

<plan>
{"name": "Real Plan", "tasks": [{"id": "1", "name": "real-task"}]}
</plan>
""",
            "expected_type": "plan",
            "expected_name": "Real Plan",
        },
        {
            "name": "Invalid JSON in plan block - should skip",
            "text": """
<plan>
{invalid json here}
</plan>

<plan>
{"name": "Valid Plan", "tasks": []}
</plan>
""",
            "expected_type": "plan",
            "expected_name": "Valid Plan",
        },
    ]

    passed = 0
    failed = 0

    for i, test in enumerate(test_cases):
        print(f"\n{'='*60}")
        print(f"Test {i+1}: {test['name']}")
        print(f"{'='*60}")

        result = extract_structured_output(test['text'])

        if result is None:
            print(f"  FAILED: No structured output found")
            failed += 1
            continue

        print(f"Found structured output:")
        print(f"  Type: {result['type']}")
        print(f"  Content: {json.dumps(result['content'], indent=2)[:200]}")

        # Check type
        if result['type'] != test['expected_type']:
            print(f"  FAILED: Expected type '{test['expected_type']}', got '{result['type']}'")
            failed += 1
            continue

        # Check expected name if specified
        if 'expected_name' in test:
            actual_name = result['content'].get('name', '')
            if actual_name != test['expected_name']:
                print(f"  FAILED: Expected name '{test['expected_name']}', got '{actual_name}'")
                failed += 1
                continue

        print(f"  PASSED")
        passed += 1

    print(f"\n{'='*60}")
    print(f"Plan extraction results: {passed} passed, {failed} failed")
    print(f"{'='*60}")

    return failed == 0


def test_review_json_block():
    """Test extraction of review content from <review> JSON blocks"""
    test_cases = [
        {
            "name": "Simple review JSON block",
            "text": """
Review complete.

<review>
{"result_status": "approved", "result_notes": "Looks good!", "issues": [], "next_steps": []}
</review>
""",
            "expected_type": "review",
            "expected_status": "approved",
        },
    ]

    passed = 0
    failed = 0

    for i, test in enumerate(test_cases):
        print(f"\n{'='*60}")
        print(f"Test {i+1}: {test['name']}")
        print(f"{'='*60}")

        result = extract_structured_output(test['text'])

        if result is None:
            print(f"  FAILED: No structured output found")
            failed += 1
            continue

        print(f"Found structured output:")
        print(f"  Type: {result['type']}")

        if result['type'] != test['expected_type']:
            print(f"  FAILED: Expected type '{test['expected_type']}', got '{result['type']}'")
            failed += 1
            continue

        if 'expected_status' in test:
            actual_status = result['content'].get('result_status', '')
            if actual_status != test['expected_status']:
                print(f"  FAILED: Expected status '{test['expected_status']}', got '{actual_status}'")
                failed += 1
                continue

        print(f"  PASSED")
        passed += 1

    print(f"\n{'='*60}")
    print(f"Review extraction results: {passed} passed, {failed} failed")
    print(f"{'='*60}")

    return failed == 0


def test_no_improvement_pattern():
    """Test that <improvement> XML blocks are no longer extracted (removed feature)"""
    text = """
<improvement>
# Some improved content
</improvement>
"""
    result = extract_structured_output(text)

    if result is None:
        print("  PASSED: <improvement> blocks are correctly ignored")
        return True
    else:
        print(f"  FAILED: <improvement> should not be extracted, got {result['type']}")
        return False


if __name__ == '__main__':
    all_passed = True
    all_passed = test_plan_json_block() and all_passed
    all_passed = test_review_json_block() and all_passed
    all_passed = test_no_improvement_pattern() and all_passed

    sys.exit(0 if all_passed else 1)
