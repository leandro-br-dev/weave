#!/usr/bin/env python3
"""
Test script to verify JSON code block extraction works correctly
"""
import sys
import json
import re

# Add client directory to path
sys.path.insert(0, '/root/projects/weave/client')

from orchestrator.runner import extract_structured_output

def test_json_code_block():
    """Test extraction of JSON from code blocks"""
    test_cases = [
        {
            "name": "Simple improvedContent in JSON block",
            "text": """
Here's my analysis of the CLAUDE.md file.

I've made several improvements to make it clearer and more effective.

```json
{"improvedContent": "# Improved CLAUDE.md\\n\\nThis is the improved content."}
```

Let me know if you need any further changes!
""",
            "expected_type": "improvement",
            "expected_content_key": "improvedContent",
        },
        {
            "name": "JSON block with extra whitespace",
            "text": """
Analysis complete.

```json
{
  "improvedContent": "Test content with more structure"
}
```

Done!
""",
            "expected_type": "improvement",
            "expected_content_key": "improvedContent",
        },
        {
            "name": "Multiple JSON blocks - should use last one",
            "text": """
Here's an example format:

```json
{"improvedContent": "example template"}
```

Now here's the actual response:

```json
{"improvedContent": "real improved content"}
```
""",
            "expected_type": "improvement",
            "expected_content_key": "improvedContent",
            "expected_value": "real improved content",
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
            print(f"❌ FAILED: No structured output found")
            failed += 1
            continue

        print(f"Found structured output:")
        print(f"  Type: {result['type']}")
        print(f"  Content keys: {list(result['content'].keys())}")

        # Check type
        if result['type'] != test['expected_type']:
            print(f"❌ FAILED: Expected type '{test['expected_type']}', got '{result['type']}'")
            failed += 1
            continue

        # Check content key exists
        if test['expected_content_key'] not in result['content']:
            print(f"❌ FAILED: Expected key '{test['expected_content_key']}' not found in content")
            failed += 1
            continue

        # Check value if specified
        if 'expected_value' in test:
            actual_value = result['content'][test['expected_content_key']]
            if actual_value != test['expected_value']:
                print(f"❌ FAILED: Expected value '{test['expected_value']}', got '{actual_value}'")
                failed += 1
                continue

        print(f"✅ PASSED")
        passed += 1

    print(f"\n{'='*60}")
    print(f"Results: {passed} passed, {failed} failed")
    print(f"{'='*60}")

    return failed == 0

if __name__ == '__main__':
    success = test_json_code_block()
    sys.exit(0 if success else 1)
