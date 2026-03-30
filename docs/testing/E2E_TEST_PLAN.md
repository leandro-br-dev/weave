# End-to-End Test Plan: Completion Detection System

## Overview
This document outlines comprehensive end-to-end testing for the completion detection system, including real daemon and API server execution.

## Test Environment

### Prerequisites
- PostgreSQL database running
- Redis cache running
- All dependencies installed
- Test database configured

### Components to Test
1. **Daemon Server** - Background task processor
2. **API Server** - REST API and WebSocket support
3. **Database** - PostgreSQL with completion_logs table
4. **Cache** - Redis for caching
5. **Frontend** - Recovery button functionality

## Test Scenarios

### 1. Happy Path: Complete Plan Execution
**Goal:** Verify a plan completes successfully with proper detection

**Steps:**
1. Start daemon and API servers
2. Create a plan with 3 tasks
3. Execute all tasks with completion logs
4. Monitor daemon logs for "✔ finished — end_turn"
5. Verify plan status changes to 'success'
6. Verify all tasks marked as completed

**Expected Results:**
- Plan status: `success`
- All tasks: `completed`
- Completion logs present in database
- Daemon logs show "✔ finished — end_turn"
- No manual intervention required

### 2. API Restart During Completion
**Goal:** Test system recovery when API restarts

**Steps:**
1. Create a plan with 5 tasks
2. Execute 3 tasks (with completion logs)
3. Stop API server
4. Execute remaining 2 tasks
5. Start API server
6. Call manual completion check endpoint
7. Verify plan completes

**Expected Results:**
- Plan completes after API restart
- Manual check endpoint works
- All tasks marked as completed
- No data loss

### 3. Network Failure Simulation
**Goal:** Test behavior during network issues

**Steps:**
1. Create a plan with 4 tasks
2. Execute 2 tasks normally
3. Simulate network failure (block API port)
4. Execute remaining tasks
5. Restore network
6. Verify auto-recovery completes plan

**Expected Results:**
- Plan status remains `in_progress` during failure
- Auto-recovery completes plan after network restored
- Daemon checker continues working
- No duplicate completion logs

### 4. Daemon Restart During Execution
**Goal:** Test daemon recovery and state persistence

**Steps:**
1. Create a plan with 6 tasks
2. Execute 4 tasks
3. Restart daemon
4. Execute remaining 2 tasks
5. Verify daemon detects completion

**Expected Results:**
- Daemon resumes checking after restart
- Plan completes successfully
- No double-counting of tasks
- Checker continues from saved state

### 5. Frontend Recovery Button
**Goal:** Test manual recovery button in UI

**Steps:**
1. Create a plan with 3 tasks
2. Execute all tasks
3. Simulate stuck plan (don't wait for auto-check)
4. Click recovery button in frontend
5. Verify plan completes immediately

**Expected Results:**
- Recovery button triggers completion check
- Plan status updates to `success`
- UI reflects completed state
- No page refresh required

### 6. Concurrent Plan Execution
**Goal:** Test system with multiple plans

**Steps:**
1. Create 3 plans simultaneously
2. Execute tasks in all plans concurrently
3. Monitor completion detection
4. Verify all plans complete correctly

**Expected Results:**
- All plans complete independently
- No cross-plan interference
- Daemon handles multiple plans
- Completion logs correctly attributed

### 7. Edge Cases

#### 7.1 Plan with No Tasks
**Steps:**
1. Create plan with empty tasks array
2. Submit for execution

**Expected Results:**
- Plan remains in `pending` status
- No completion check attempted
- Appropriate error or handling

#### 7.2 Plan with Already Completed Tasks
**Steps:**
1. Create plan
2. Mark all tasks as completed manually
3. Submit for completion check

**Expected Results:**
- Plan marked as `success`
- All completion logs counted
- No duplicate processing

#### 7.3 Mixed Completion Log Patterns
**Steps:**
1. Create plan with 5 tasks
2. Use different completion log patterns:
   - "✔ finished — end_turn"
   - "Task completed: Task 3"
   - "✓ Done with task_4"
   - "Completed task_5 successfully"
3. Verify all patterns detected

**Expected Results:**
- All completion patterns detected
- All tasks marked as completed
- Plan status changes to `success`

## Success Criteria

### Critical Success Factors
- ✅ All happy path tests pass
- ✅ Recovery mechanisms work correctly
- ✅ No data loss during failures
- ✅ Frontend integration works
- ✅ Concurrent execution handled
- ✅ Edge cases properly handled

### Performance Criteria
- Completion detection within 60 seconds
- Manual check completes within 5 seconds
- Daemon restart recovery within 30 seconds
- API restart recovery within 10 seconds

### Logging Criteria
- All completion events logged
- Error scenarios properly logged
- Recovery actions logged
- No missing log entries

## Test Execution Order

### Phase 1: Basic Functionality
1. Happy Path test
2. Edge cases tests

### Phase 2: Failure Scenarios
3. API restart test
4. Daemon restart test
5. Network failure test

### Phase 3: Integration
6. Frontend recovery button test
7. Concurrent execution test

### Phase 4: Documentation
8. Compile results
9. Document issues
10. Create final report

## Test Data

### Sample Plan Structure
```json
{
  "id": "test-plan-001",
  "title": "E2E Test Plan",
  "description": "End-to-end test plan",
  "goal": "Test completion detection",
  "status": "pending",
  "tasks": [
    {
      "id": "task-1",
      "title": "Task 1",
      "description": "First task",
      "status": "pending",
      "type": "coding"
    },
    {
      "id": "task-2",
      "title": "Task 2",
      "description": "Second task",
      "status": "pending",
      "type": "coding"
    }
  ]
}
```

### Sample Completion Logs
```
[INFO] Starting task_1
[INFO] Working on task_1
[INFO] ✔ finished — end_turn
[INFO] Starting task_2
[INFO] Working on task_2
[INFO] Task completed: Task 2
```

## Monitoring Commands

### Watch Daemon Logs
```bash
tail -f logs/daemon.log | grep -E "(finished|completion|check-completion)"
```

### Watch API Logs
```bash
tail -f logs/api.log | grep -E "(completion|check)"
```

### Monitor Database
```sql
SELECT COUNT(*) FROM completion_logs WHERE plan_id = 'test-plan-001';
SELECT * FROM plans WHERE id = 'test-plan-001';
SELECT * FROM tasks WHERE plan_id = 'test-plan-001';
```

### Monitor Redis
```bash
redis-cli
> KEYS plan:*
> GET plan:test-plan-001
```

## Cleanup Procedures

### After Each Test
1. Delete test plans from database
2. Clear completion logs
3. Reset daemon state
4. Verify no stuck processes

### After All Tests
1. Stop all servers
2. Clean up test data
3. Archive logs
4. Generate final report

## Reporting Template

### Test Results Summary
| Test ID | Test Name | Status | Duration | Notes |
|---------|-----------|--------|----------|-------|
| E2E-001 | Happy Path | ⏳ | - | - |
| E2E-002 | API Restart | ⏳ | - | - |
| E2E-003 | Network Failure | ⏳ | - | - |
| E2E-004 | Daemon Restart | ⏳ | - | - |
| E2E-005 | Frontend Recovery | ⏳ | - | - |
| E2E-006 | Concurrent Execution | ⏳ | - | - |
| E2E-007 | Edge Cases | ⏳ | - | - |

### Issues Found
| Issue ID | Severity | Description | Status |
|----------|----------|-------------|--------|
| - | - | - | - |

### Recommendations
- [List recommendations for improvements]

## Sign-off
- **Test Executor:** [Name]
- **Test Date:** [Date]
- **Test Duration:** [Total time]
- **Overall Result:** [Pass/Fail]
- **Approval:** [Signature]
