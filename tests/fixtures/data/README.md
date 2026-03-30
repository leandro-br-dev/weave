# Test Data Fixtures

This directory contains static test data files used across the test suite.

## Purpose

Data fixtures provide sample input data, expected outputs, and configuration files for testing. These files help ensure consistent test data across multiple test runs and make tests more maintainable.

## Directory Structure

```
data/
├── inputs/         # Sample input data for tests
├── outputs/        # Expected output data
├── configs/        # Configuration file samples
└── README.md       # This file
```

## Types of Test Data

### Input Data (`inputs/`)
Sample data used as input for tests:
- JSON payloads
- XML samples
- CSV files
- Text files
- Binary data

### Output Data (`outputs/`)
Expected results for assertion comparisons:
- Expected JSON responses
- Expected file contents
- Expected error messages
- Expected transformation results

### Configuration Data (`configs/`)
Sample configuration files:
- App configuration samples
- Environment variable templates
- Feature flag configurations
- Mock API responses

## Guidelines for Adding Test Data

### File Naming

Use descriptive, consistent naming conventions:
- `sample-{entity}.json` - Sample entity data
- `expected-{result}.txt` - Expected output
- `mock-{service}-response.json` - Mock API responses
- `config-{scenario}.{ext}` - Configuration samples

### File Organization

1. **Keep it small**: Test data files should be minimal and focused
2. **Use comments**: Add comments in JSON/TXT files to explain purpose
3. **Version control**: Commit all test data to version control
4. **Document structure**: Include schema or structure documentation
5. **Avoid duplication**: Share common data across tests when possible

### Example Structure

```
data/
├── inputs/
│   ├── sample-agent.json
│   ├── sample-workspace.json
│   └── test-improvement-prompt.txt
├── outputs/
│   ├── expected-improved-claude-md.txt
│   └── expected-api-response.json
└── configs/
    ├── test-config.json
    └── mock-api-responses.json
```

## Best Practices

### JSON Data
```json
{
  "_comment": "Sample agent data for testing creation endpoint",
  "name": "test-agent",
  "type": "assistant",
  "status": "active",
  "config": {
    "model": "claude-3-5-sonnet",
    "temperature": 0.7
  }
}
```

### Text Data
```
# Test improvement prompt
# Purpose: Verify prompt formatting and validation

This is a test prompt for the improvement workflow.
It should be properly formatted and validated.
```

### Configuration Data
```json
{
  "_description": "Test configuration for local development",
  "environment": "test",
  "features": {
    "improvementWorkflow": true,
    "autoApprove": false
  }
}
```

## Usage in Tests

### Python (pytest)
```python
import json
from pathlib import Path

def test_agent_creation():
    # Load sample data
    data_file = Path(__file__).parent.parent / 'fixtures' / 'data' / 'inputs' / 'sample-agent.json'
    with open(data_file) as f:
        agent_data = json.load(f)

    # Use in test
    agent = Agent.create(agent_data)
    assert agent.name == "test-agent"
```

### JavaScript (Jest)
```javascript
import fs from 'fs';
import path from 'path';

describe('Agent Tests', () => {
  test('creates agent with sample data', () => {
    const dataPath = path.join(__dirname, '../fixtures/data/inputs/sample-agent.json');
    const agentData = JSON.parse(fs.readFileSync(dataPath));

    const agent = Agent.create(agentData);
    expect(agent.name).toBe('test-agent');
  });
});
```

## Maintenance

- **Regular updates**: Keep test data in sync with schema changes
- **Clean up**: Remove unused test data files
- **Document**: Add comments explaining purpose and usage
- **Validate**: Ensure test data is valid and well-formed

## Related Documentation

- [Main Fixtures README](../README.md)
- [Testing Guide](../../../docs/testing/testing-guide.md)
- [Test Organization](../../../docs/testing/test-organization.md)
