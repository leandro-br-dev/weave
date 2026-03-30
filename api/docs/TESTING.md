# API Testing

Testing guide, verification, and test coverage for the Weave API.

## Table of Contents

- [Testing Overview](#testing-overview)
- [Test Environment Setup](#test-environment-setup)
- [Running Tests](#running-tests)
- [Test Coverage](#test-coverage)
- [Manual Testing](#manual-testing)
- [API Testing Tools](#api-testing-tools)
- [Integration Testing](#integration-testing)
- [Load Testing](#load-testing)
- [Test Data Management](#test-data-management)

---

## Testing Overview

### Test Framework

The API uses **Vitest** for testing:

- **Framework**: Vitest
- **Language**: TypeScript
- **Test Files**: `*.test.ts` files alongside source code
- **Runner**: `npm test`

### Current Test Status

- **Plans Tests**: ✅ Comprehensive coverage
- **Kanban Tests**: ✅ Comprehensive coverage
- **Other Routes**: ⚠️ Limited coverage (needs expansion)

---

## Test Environment Setup

### Prerequisites

```bash
# Install dependencies
npm install

# Set test environment variables
export API_BEARER_TOKEN="test-token"
export PORT=3001  # Use different port for testing
```

### Test Database

Tests can use a separate test database:

```bash
# Set test database path
export TEST_DATABASE_PATH="./data/test-database.db"
```

---

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Specific Test File

```bash
npm test -- plans.test.ts
npm test -- kanban.test.ts
```

### Run with Coverage

```bash
npm run test:coverage
```

### Watch Mode

```bash
npm run test:watch
```

---

## Test Coverage

### Plans Endpoint Tests (`routes/plans.test.ts`)

#### Covered Scenarios

1. **GET /api/plans**
   - ✅ List all plans
   - ✅ Filter by project_id

2. **POST /api/plans**
   - ✅ Create plan with valid data
   - ✅ Validate required fields
   - ✅ Task ID sanitization
   - ✅ Status validation

3. **GET /api/plans/:id**
   - ✅ Get existing plan
   - ✅ Plan not found (404)
   - ✅ Log count inclusion
   - ✅ Structured output parsing

4. **PUT /api/plans/:id**
   - ✅ Update pending plan
   - ✅ Cannot edit running plan
   - ✅ Plan not found (404)

5. **POST /api/plans/:id/start**
   - ✅ Start pending plan
   - ✅ Validate client_id
   - ✅ Cannot start non-pending plan

6. **POST /api/plans/:id/complete**
   - ✅ Complete with success
   - ✅ Complete with failure
   - ✅ Validate status and result
   - ✅ Structured output support

7. **POST /api/plans/:id/logs**
   - ✅ Append log entries
   - ✅ Validate logs array
   - ✅ Plan not found (404)

8. **GET /api/plans/:id/logs**
   - ✅ Get plan logs
   - ✅ Plan not found (404)

9. **POST /api/plans/:id/execute**
   - ✅ Re-queue failed plan
   - ✅ Cannot execute running plan

10. **POST /api/plans/:id/force-stop**
    - ✅ Force stop running plan
    - ✅ Force stop pending plan
    - ✅ Cannot stop stopped plan

11. **POST /api/plans/:id/resume**
    - ✅ Resume failed plan
    - ✅ Cannot resume running plan
    - ✅ Cannot resume successful plan

12. **DELETE /api/plans/:id**
    - ✅ Delete existing plan
    - ✅ Cannot delete running plan

13. **GET /api/plans/pending**
    - ✅ Get pending plans

14. **GET /api/plans/metrics**
    - ✅ Get global metrics
    - ✅ Calculate success rate
    - ✅ Calculate average duration

### Kanban Endpoint Tests (`routes/kanban.test.ts`)

#### Covered Scenarios

1. **GET /api/kanban**
   - ✅ List all kanban tasks
   - ✅ Include project and workflow info

2. **GET /api/kanban/:projectId**
   - ✅ List tasks for project
   - ✅ Order by column and priority

3. **POST /api/kanban/:projectId**
   - ✅ Create new task
   - ✅ Validate title
   - ✅ Project not found (404)

4. **PUT /api/kanban/:projectId/:taskId**
   - ✅ Update task
   - ✅ Handle boolean is_template
   - ✅ Task not found (404)

5. **DELETE /api/kanban/:projectId/:taskId**
   - ✅ Delete task
   - ✅ Task not found (404)

6. **PATCH /api/kanban/:projectId/:taskId/pipeline**
   - ✅ Update pipeline status
   - ✅ Update all fields
   - ✅ Task not found (404)

7. **POST /api/kanban/:projectId/auto-move**
   - ✅ Auto-move backlog → planning
   - ✅ Auto-move planning → in_progress
   - ✅ No move when conditions not met
   - ✅ Project not found (404)

---

## Manual Testing

### Health Check

```bash
curl http://localhost:3000/api/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "message": "Weave API is running"
}
```

### Authentication Test

```bash
# Without token (should fail)
curl http://localhost:3000/api/plans

# With token (should succeed)
curl -H "Authorization: Bearer dev-token-change-in-production" \
  http://localhost:3000/api/plans
```

### Plans CRUD

#### Create Plan

```bash
curl -X POST http://localhost:3000/api/plans \
  -H "Authorization: Bearer dev-token-change-in-production" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Plan",
    "tasks": [
      {
        "id": "task-1",
        "name": "First Task",
        "prompt": "Do something",
        "cwd": "/root/projects/weave",
        "workspace": "/root/projects/weave/projects/test/agents/coder",
        "tools": ["Read", "Write"],
        "permission_mode": "acceptEdits",
        "depends_on": []
      }
    ],
    "project_id": "test-project-id"
  }'
```

#### Get Plan

```bash
curl -H "Authorization: Bearer dev-token-change-in-production" \
  http://localhost:3000/api/plans/<plan-id>
```

#### Start Plan

```bash
curl -X POST http://localhost:3000/api/plans/<plan-id>/start \
  -H "Authorization: Bearer dev-token-change-in-production" \
  -H "Content-Type: application/json" \
  -d '{"client_id": "test-client"}'
```

#### Complete Plan

```bash
curl -X POST http://localhost:3000/api/plans/<plan-id>/complete \
  -H "Authorization: Bearer dev-token-change-in-production" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "success",
    "result": "Plan completed successfully"
  }'
```

#### Delete Plan

```bash
curl -X DELETE http://localhost:3000/api/plans/<plan-id> \
  -H "Authorization: Bearer dev-token-change-in-production"
```

### Workspaces CRUD

#### List Workspaces

```bash
curl -H "Authorization: Bearer dev-token-change-in-production" \
  http://localhost:3000/api/workspaces
```

#### Get Workspace

```bash
curl -H "Authorization: Bearer dev-token-change-in-production" \
  http://localhost:3000/api/workspaces/<workspace-id>
```

#### Create Workspace

```bash
curl -X POST http://localhost:3000/api/workspaces \
  -H "Authorization: Bearer dev-token-change-in-production" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-agent",
    "project_path": "/root/projects/test",
    "project_id": "test-project-id",
    "template_id": "generic"
  }'
```

#### Update Workspace Properties

```bash
curl -X PUT http://localhost:3000/api/workspaces/<workspace-id> \
  -H "Authorization: Bearer dev-token-change-in-production" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "reviewer",
    "model": "claude-sonnet-4-6"
  }'
```

#### Delete Workspace

```bash
curl -X DELETE http://localhost:3000/api/workspaces/<workspace-id> \
  -H "Authorization: Bearer dev-token-change-in-production"
```

### Projects CRUD

#### List Projects

```bash
curl -H "Authorization: Bearer dev-token-change-in-production" \
  http://localhost:3000/api/projects
```

#### Create Project

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Authorization: Bearer dev-token-change-in-production" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project",
    "description": "A test project"
  }'
```

#### Get Project

```bash
curl -H "Authorization: Bearer dev-token-change-in-production" \
  http://localhost:3000/api/projects/<project-id>
```

#### Create Environment

```bash
curl -X POST http://localhost:3000/api/projects/<project-id>/environments \
  -H "Authorization: Bearer dev-token-change-in-production" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "dev",
    "type": "local-wsl",
    "project_path": "/root/projects/test"
  }'
```

---

## API Testing Tools

### cURL

Command-line tool for testing HTTP requests:

```bash
# Basic GET request
curl -H "Authorization: Bearer token" http://localhost:3000/api/plans

# POST request
curl -X POST http://localhost:3000/api/plans \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test"}'

# Verbose output
curl -v http://localhost:3000/api/health

# Include response headers
curl -i http://localhost:3000/api/health
```

### HTTPie

More user-friendly alternative to cURL:

```bash
# GET request
http GET http://localhost:3000/api/plans \
  Authorization:dev-token-change-in-production

# POST request
http POST http://localhost:3000/api/plans \
  Authorization:dev-token-change-in-production \
  name="Test Plan" \
  tasks:=[]

# Formatted output
http --pretty=format GET http://localhost:3000/api/plans
```

### Postman

GUI tool for API testing:

1. **Import Collection** - Create a new collection for Weave API
2. **Set Base URL** - `http://localhost:3000/api`
3. **Add Authentication** - Bearer token in Authorization header
4. **Create Requests** - Add requests for each endpoint
5. **Save Examples** - Save example responses for documentation

### Insomnia

Alternative to Postman:

1. **Create New Request** - Choose HTTP method
2. **Set URL** - Enter endpoint URL
3. **Add Headers** - Add Authorization header
4. **Send Request** - View response

---

## Integration Testing

### Test Scenarios

#### 1. End-to-End Plan Execution

```typescript
// Create project
const project = await createProject({
  name: 'Test Project',
  description: 'Integration test'
})

// Create workspace
const workspace = await createWorkspace({
  name: 'test-agent',
  project_id: project.id
})

// Create plan
const plan = await createPlan({
  name: 'Test Plan',
  tasks: [{
    id: 'task-1',
    name: 'Test Task',
    prompt: 'Test',
    workspace: workspace.path,
    tools: ['Read']
  }],
  project_id: project.id
})

// Start plan
await startPlan(plan.id, { client_id: 'test-client' })

// Complete plan
await completePlan(plan.id, {
  status: 'success',
  result: 'Done'
})

// Verify plan status
const finalPlan = await getPlan(plan.id)
assert.equal(finalPlan.status, 'success')
```

#### 2. Workspace to Project Linking

```typescript
// Create project
const project = await createProject({ name: 'Test' })

// Create workspace
const workspace = await createWorkspace({
  name: 'agent',
  project_id: project.id
})

// Verify linkage
const linkedAgents = await getProjectAgents(project.id)
assert.include(linkedAgents, workspace.path)

// Unlink workspace
await unlinkWorkspace(project.id, workspace.path)

// Verify unlinked
const agentsAfter = await getProjectAgents(project.id)
assert.notInclude(agentsAfter, workspace.path)
```

#### 3. Kanban Auto-Move

```typescript
// Create project
const project = await createProject({ name: 'Test' })

// Create backlog task
const task1 = await createKanbanTask(project.id, {
  title: 'Task 1',
  column: 'backlog',
  priority: 1
})

// Create another backlog task
const task2 = await createKanbanTask(project.id, {
  title: 'Task 2',
  column: 'backlog',
  priority: 2
})

// Trigger auto-move
const result = await autoMoveKanban(project.id)

// Verify task1 moved to planning
const updatedTask1 = await getKanbanTask(project.id, task1.id)
assert.equal(updatedTask1.column, 'planning')

// Verify task2 stayed in backlog
const updatedTask2 = await getKanbanTask(project.id, task2.id)
assert.equal(updatedTask2.column, 'backlog')
```

---

## Load Testing

### Using Apache Bench (ab)

```bash
# Install ab
sudo apt-get install apache2-utils

# Test GET endpoint
ab -n 1000 -c 10 \
  -H "Authorization: Bearer dev-token-change-in-production" \
  http://localhost:3000/api/plans

# Test POST endpoint
ab -n 100 -c 5 \
  -H "Authorization: Bearer dev-token-change-in-production" \
  -H "Content-Type: application/json" \
  -p post_data.json \
  http://localhost:3000/api/plans
```

### Using wrk

```bash
# Install wrk
sudo apt-get install wrk

# Run load test
wrk -t4 -c100 -d30s \
  -H "Authorization: Bearer dev-token-change-in-production" \
  http://localhost:3000/api/plans
```

### Using k6

```javascript
// load-test.js
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 100,
  duration: '30s',
};

export default function () {
  let headers = {
    'Authorization': 'Bearer dev-token-change-in-production',
  };

  let res = http.get('http://localhost:3000/api/plans', { headers });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

Run k6 test:
```bash
k6 run load-test.js
```

---

## Test Data Management

### Test Database Reset

```bash
# Remove test database
rm -f ./data/test-database.db

# Reset test database
npm run test:reset
```

### Seed Test Data

```typescript
// seed-test-data.ts
import { db } from './src/db/index.js'

export function seedTestData() {
  // Create test project
  const projectId = uuid()
  db.prepare('INSERT INTO projects (id, name, description) VALUES (?, ?, ?)')
    .run(projectId, 'Test Project', 'For testing')

  // Create test plan
  const planId = uuid()
  db.prepare('INSERT INTO plans (id, name, tasks, project_id) VALUES (?, ?, ?, ?)')
    .run(planId, 'Test Plan', '[]', projectId)

  return { projectId, planId }
}

export function clearTestData() {
  db.prepare('DELETE FROM plans WHERE project_id IN (SELECT id FROM projects WHERE name = "Test Project")').run()
  db.prepare('DELETE FROM projects WHERE name = "Test Project"').run()
}
```

### Test Fixtures

```typescript
// fixtures.ts
export const testPlan = {
  name: 'Test Plan',
  tasks: [{
    id: 'task-1',
    name: 'Test Task',
    prompt: 'Test',
    workspace: '/test/workspace',
    tools: ['Read'],
    permission_mode: 'acceptEdits',
    depends_on: []
  }],
  project_id: 'test-project-id'
}

export const testWorkspace = {
  name: 'test-agent',
  project_path: '/test/project',
  project_id: 'test-project-id',
  template_id: 'generic'
}

export const testProject = {
  name: 'Test Project',
  description: 'Test description'
}
```

---

## Continuous Integration

### GitHub Actions Example

```yaml
# .github/workflows/api-tests.yml
name: API Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install dependencies
      run: npm ci
      working-directory: ./api

    - name: Run tests
      run: npm test
      working-directory: ./api

    - name: Generate coverage
      run: npm run test:coverage
      working-directory: ./api

    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        files: ./api/coverage/lcov.info
```

---

## Debugging Tests

### Console Output

```typescript
import { describe, it, expect } from 'vitest'

describe('Debug test', () => {
  it('should print debug info', () => {
    const data = { key: 'value' }
    console.log('Debug:', data)
    expect(data.key).toBe('value')
  })
})
```

### Breakpoint Debugging

1. **Set Breakpoint in VS Code**
   - Click left of line number in test file
   - Red dot appears

2. **Create `.vscode/launch.json`**
   ```json
   {
     "version": "0.2.0",
     "configurations": [
       {
         "type": "node",
         "request": "launch",
         "name": "Debug Vitest",
         "program": "${workspaceFolder}/api/node_modules/.bin/vitest",
         "args": ["run", "--reporter=verbose"],
         "cwd": "${workspaceFolder}/api",
         "console": "integratedTerminal"
       }
     ]
   }
   ```

3. **Start Debugging**
   - Press F5 or click "Run and Debug"

---

## Best Practices

### Test Organization

1. **Group Related Tests**
   ```typescript
   describe('POST /api/plans', () => {
     describe('Validation', () => {
       it('should require name', () => {})
       it('should require tasks', () => {})
     })

     describe('Creation', () => {
       it('should create plan', () => {})
       it('should sanitize task IDs', () => {})
     })
   })
   ```

2. **Use Descriptive Test Names**
   ```typescript
   // ✅ GOOD
   it('should return 404 when plan does not exist', () => {})

   // ❌ BAD
   it('should fail', () => {})
   ```

3. **Setup and Teardown**
   ```typescript
   beforeEach(() => {
     // Setup test data
   })

   afterEach(() => {
     // Clean up test data
   })
   ```

### Test Data

1. **Use Factories**
   ```typescript
   function createPlan(overrides = {}) {
     return {
       name: 'Test Plan',
       tasks: [],
       ...overrides
     }
   }
   ```

2. **Isolate Tests**
   - Each test should be independent
   - Don't rely on test execution order

3. **Clean Up**
   - Always clean up test data
   - Use transactions that roll back

### Assertions

1. **Use Specific Assertions**
   ```typescript
   // ✅ GOOD
   expect(response.status).toBe(200)
   expect(response.data.id).toBeDefined()

   // ❌ BAD
   expect(response).toBeTruthy()
   ```

2. **Assert One Thing Per Test**
   ```typescript
   // ✅ GOOD
   it('should set status to running', () => {
     expect(plan.status).toBe('running')
   })

   // ❌ BAD
   it('should update plan', () => {
     expect(plan.status).toBe('running')
     expect(plan.started_at).toBeDefined()
     expect(plan.client_id).toBe('test-client')
   })
   ```

---

For endpoint documentation, see [ENDPOINTS.md](./ENDPOINTS.md).
For architecture information, see [ARCHITECTURE.md](./ARCHITECTURE.md).
For implementation details, see [IMPLEMENTATION.md](./IMPLEMENTATION.md).
