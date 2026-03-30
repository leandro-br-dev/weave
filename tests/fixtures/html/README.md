# HTML Test Fixtures

This directory contains interactive HTML-based testing utilities for manual testing and development.

## Purpose

HTML fixtures provide standalone, browser-based tools for testing specific features without requiring the full application to be running. They are particularly useful for:

- **Manual testing**: Interactive testing of UI components and features
- **Development debugging**: Quick verification of functionality during development
- **Demo purposes**: Showcasing specific features to stakeholders
- **LocalStorage testing**: Testing browser storage behaviors

## Available Fixtures

### `test-improvement-modal.html`

**Purpose**: Interactive testing helper for the AI improvement modal localStorage persistence feature.

**Features**:
- Visual localStorage inspector
- Buttons to simulate different improvement states (recent, old, invalid)
- Pre-configured test scenarios
- Step-by-step testing instructions
- Real-time localStorage manipulation

**Usage**:
```bash
# Open directly in a browser
open tests/fixtures/html/test-improvement-modal.html

# Or with a local server
python -m http.server 8000
# Navigate to: http://localhost:8000/tests/fixtures/html/test-improvement-modal.html
```

**Test Scenarios Covered**:
1. Normal flow - Recent improvement (< 1hr)
2. Stale data - Old improvement (> 1hr)
3. Invalid data - Malformed JSON handling

**Related Documentation**:
- [localStorage Reference](../../../docs/reference/localstorage.md)
- [Implementation Summary](../../../docs/testing/reports/LOCALSTORAGE_PERSISTENCE_SUMMARY.md)

## Guidelines for Adding HTML Fixtures

### File Structure

Each HTML fixture should be:
- **Self-contained**: Include all CSS and JavaScript inline
- **Well-documented**: Include clear instructions and purpose
- **Browser-compatible**: Work across modern browsers
- **Accessible**: Follow basic accessibility guidelines

### Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Feature Testing Helper</title>
  <style>
    /* Include all styles inline */
  </style>
</head>
<body>
  <h1>Feature Name Testing Helper</h1>
  <p>Clear description of what this fixture tests.</p>

  <!-- Testing interface -->

  <script>
    // Include all JavaScript inline
  </script>
</body>
</html>
```

### Best Practices

1. **Inline Everything**: Keep CSS and JavaScript inline for portability
2. **Clear Instructions**: Include usage instructions in the HTML
3. **Error Handling**: Handle errors gracefully with user feedback
4. **Responsive Design**: Use responsive design for different screen sizes
5. **No Dependencies**: Avoid external dependencies if possible
6. **Descriptive Titles**: Use clear, descriptive page titles

## Maintenance

- **Keep Updated**: Update fixtures when application features change
- **Test Regularly**: Verify fixtures work as expected
- **Document Changes**: Update README when adding/modifying fixtures
- **Remove Unused**: Delete fixtures that are no longer needed

## Related Documentation

- [Main Fixtures README](../README.md)
- [Testing Guide](../../../docs/testing/testing-guide.md)
- [Test Migration Log](../../../docs/testing/test-migration-log.md)
