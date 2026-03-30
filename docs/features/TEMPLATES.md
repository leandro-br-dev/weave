# Kanban Templates System

## Overview

The Kanban Templates system provides a way to create reusable kanban board layouts with predefined columns and tasks. This allows users to quickly set up new projects with established workflows and best practices.

## Architecture

### Database Schema

The template system uses three interconnected tables:

1. **`kanban_templates`** - Main template definitions
2. **`kanban_template_columns`** - Column definitions within templates
3. **`kanban_template_tasks`** - Task definitions within columns

### Relationships

```
projects (1) ──────< (N) kanban_templates
                          │
                          │ (1) ──────< (N) kanban_template_columns
                                                 │
                                                 │ (1) ──────< (N) kanban_template_tasks
```

## Migration from Old System

### Previous Implementation

Previously, templates were stored as special records in the `kanban_tasks` table with `is_template = 1`. This approach had several limitations:

- Templates mixed with regular tasks
- No dedicated template management
- Difficult to maintain template structures
- Limited support for reusable layouts

### New Implementation

The new system provides:

- **Dedicated template tables** - Separates template definitions from regular tasks
- **Structured hierarchy** - Templates → Columns → Tasks
- **Public/private templates** - Templates can be project-specific or shared across projects
- **Better management** - Full CRUD operations for templates

### Migration Notes

The old `is_template`, `recurrence`, `next_run_at`, and `last_run_at` columns in `kanban_tasks` are kept for backwards compatibility but are deprecated. New code should use the dedicated template tables.

## API Endpoints

### Get Templates
```bash
GET /api/templates?project_id={uuid}
```

### Get Single Template
```bash
GET /api/templates/{uuid}
```

### Create Template
```bash
POST /api/templates
Content-Type: application/json

{
  "title": "Software Development Workflow",
  "description": "Standard agile development process",
  "project_id": "uuid",
  "priority": 3,
  "is_public": 1,
  "columns": [
    {
      "name": "Backlog",
      "order_index": 0,
      "tasks": [
        {
          "title": "Initial requirements gathering",
          "description": "Gather and document project requirements",
          "priority": 2,
          "order_index": 0
        }
      ]
    },
    {
      "name": "In Progress",
      "order_index": 1,
      "tasks": []
    }
  ]
}
```

### Update Template
```bash
PUT /api/templates/{uuid}
Content-Type: application/json

{
  "title": "Updated template title",
  "description": "Updated description"
}
```

### Delete Template
```bash
DELETE /api/templates/{uuid}
```

## Template Structure

### Template Object

```typescript
interface Template {
  id: string;
  project_id: string;
  title: string;
  description: string;
  priority: number;        // 1-5 (1=Critical, 5=Lowest)
  recurrence: string;
  next_run_at: string | null;
  last_run_at: string | null;
  is_public: number;       // 1=public, 0=private
  created_at: string;
  updated_at: string;
}
```

### Template Column Object

```typescript
interface TemplateColumn {
  id: string;
  template_id: string;
  name: string;            // Column name
  order_index: number;     // Display order
  created_at: string;
}
```

### Template Task Object

```typescript
interface TemplateTask {
  id: string;
  template_column_id: string;
  title: string;
  description: string;
  priority: number;        // 1-5 (1=Critical, 5=Lowest)
  order_index: number;     // Display order
  tags: string;            // Comma-separated tags
  created_at: string;
}
```

## Use Cases

### 1. Project Setup Templates

Create templates for different project types:

```json
{
  "title": "Web Development Project",
  "columns": [
    {"name": "Backlog", "tasks": [
      {"title": "Setup development environment", "priority": 1},
      {"title": "Design database schema", "priority": 2}
    ]},
    {"name": "In Progress", "tasks": []},
    {"name": "Code Review", "tasks": []},
    {"name": "Done", "tasks": []}
  ]
}
```

### 2. Process Templates

Define standard workflows:

```json
{
  "title": "Feature Development Process",
  "columns": [
    {"name": "Requirements", "tasks": [
      {"title": "Write functional requirements", "priority": 1},
      {"title": "Create mockups", "priority": 2}
    ]},
    {"name": "Development", "tasks": [
      {"title": "Implement core functionality", "priority": 1},
      {"title": "Write unit tests", "priority": 2}
    ]},
    {"name": "Testing", "tasks": []},
    {"name": "Deployment", "tasks": []}
  ]
}
```

### 3. Team-Specific Templates

Customize for different team workflows:

```json
{
  "title": "DevOps Team Workflow",
  "columns": [
    {"name": "Monitoring", "tasks": [
      {"title": "Check system alerts", "priority": 1}
    ]},
    {"name": "Investigation", "tasks": []},
    {"name": "Implementation", "tasks": []},
    {"name": "Validation", "tasks": []}
  ]
}
```

## Frontend Integration

### Using Templates in the Dashboard

1. **Browse Templates** - View available templates in the template gallery
2. **Preview Template** - See the template structure before applying
3. **Apply Template** - Create a new kanban board from a template
4. **Customize** - Modify the applied board as needed

### Template Application Flow

```typescript
// 1. Get available templates
const templates = await fetch(`/api/templates?project_id=${projectId}`);

// 2. Apply template to create kanban board
const result = await fetch(`/api/templates/${templateId}/apply`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ create_tasks: true })
});
```

## Testing

The template system includes comprehensive tests:

- **Unit Tests** - Template CRUD operations
- **Integration Tests** - Template application to kanban boards
- **Migration Tests** - Data migration from old to new system

Run tests with:
```bash
npm test -- templates.test.ts
```

## Best Practices

### Template Design

1. **Keep Focused** - Each template should serve a specific purpose
2. **Use Clear Names** - Descriptive titles and help text
3. **Set Priorities** - Default priorities help with task ordering
4. **Add Context** - Include descriptions for tasks and columns
5. **Test Templates** - Verify template application before sharing

### Template Management

1. **Version Control** - Use descriptive names to track template versions
2. **Documentation** - Maintain external docs for complex templates
3. **Regular Updates** - Keep templates aligned with process changes
4. **Access Control** - Use `is_public` flag appropriately

## Future Enhancements

Potential improvements to the template system:

- Template versioning and history
- Template categories and tags
- Template marketplace/sharing
- Conditional task creation
- Template variables and placeholders
- Import/export functionality
- Template validation rules

## Troubleshooting

### Common Issues

**Issue**: Template not appearing in list
- **Solution**: Check `project_id` and `is_public` flags

**Issue**: Tasks not created when applying template
- **Solution**: Verify `create_tasks: true` in request body

**Issue**: Invalid template structure
- **Solution**: Validate column and task objects before creation

### Debug Queries

```sql
-- Check existing templates
SELECT * FROM kanban_templates WHERE project_id = 'your-uuid';

-- Count template columns
SELECT template_id, COUNT(*) as column_count
FROM kanban_template_columns
GROUP BY template_id;

-- Count template tasks
SELECT tc.template_id, COUNT(*) as task_count
FROM kanban_template_tasks ttt
JOIN kanban_template_columns tc ON ttt.template_column_id = tc.id
GROUP BY tc.template_id;
```

## Related Documentation

- [Features Overview](FEATURES.md)
- [Architecture](../architecture/ARCHITECTURE.md)