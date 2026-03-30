# Legacy Test Scripts

This directory contains archived test scripts that have been superseded by newer, more comprehensive tests. These files are maintained for historical reference and rollback purposes.

**Archive Date:** 2026-03-19
**Retention Policy:** 6 months (until 2026-09-19)

---

## 📋 Table of Contents

- [Purpose](#purpose)
- [Archived Files](#archived-files)
- [Migration Guide](#migration-guide)
- [Restoration Instructions](#restoration-instructions)
- [Cleanup Policy](#cleanup-policy)

---

## 🎯 Purpose

Test scripts are moved to the `legacy/` directory when they meet one or more of the following criteria:

1. **Superseded by Newer Tests**: A more comprehensive test has been created that includes all functionality
2. **Duplicate Functionality**: The test overlaps significantly (>75%) with another test
3. **Outdated Approach**: The test uses deprecated methods or patterns
4. **Poor Maintainability**: The test has structural issues that make it difficult to maintain

**Important**: Legacy tests are **not actively maintained** and may not work with current code versions. They are kept for reference only.

---

## 📁 Archived Files

### 1. `test-improvement-fix.sh`

**Archive Date:** 2025-03-19 (before consolidation)
**Status:** LEGACY - Superseded
**Original Location:** Root directory

**Why It Was Archived:**
- Functionality covered by more comprehensive E2E tests
- Newer tests provide better coverage and reporting
- Maintained for historical reference and rollback purposes

**Current Replacement:**
- **Use:** `tests/scripts/e2e/test-improvement-comprehensive.sh`
- **Benefits:** Better test coverage, improved error handling, detailed reporting

**Key Features (Lost in Replacement):**
- Automatic test data creation (workspace + agent)
- Logging to `/tmp` with timestamps
- Proper cleanup (deletes test data)
- Test result tracking

---

### 2. `test-improvement-workflow.sh`

**Archive Date:** 2026-03-19
**Status:** LEGACY - Superseded
**Original Location:** `tests/scripts/workflow/`

**Why It Was Archived:**
- 80% overlap with `test-improvement-end-to-end.sh`
- 100% of functionality now in `test-improvement-comprehensive.sh`
- No unique test cases
- Maintaining both creates update burden

**Current Replacement:**
- **Use:** `tests/scripts/e2e/test-improvement-comprehensive.sh`
- **Benefits:**
  - Includes all 6 test functions from this script
  - Adds 5 more tests (11 total vs 6)
  - Better error handling and reporting
  - Test tracking with pass/fail counters
  - Edge case testing

**Original Test Coverage:**
1. API health check (`check_api`)
2. List workspaces (`test_list_workspaces`)
3. Get test workspace (`get_test_workspace`)
4. Create improvement task (`test_create_improvement`)
5. Check plan status (`test_check_plan_status`)
6. Save structured output (`test_save_structured_output`)
7. Verify structured output (`test_verify_structured_output`)

**Unique Value (Lost in Replacement):**
- Simple, straightforward structure
- Good for quick smoke tests
- Used API on port 3001 (different from standard 3000)

---

### 3. `test-improvement-end-to-end.sh`

**Archive Date:** 2026-03-19
**Status:** LEGACY - Superseded
**Original Location:** `tests/scripts/e2e/`

**Why It Was Archived:**
- 75% overlap with `test-improvement-workflow.sh`
- All functionality merged into `test-improvement-comprehensive.sh`
- Edge cases (25% unique) already ported to comprehensive test
- Comprehensive test has better structure

**Current Replacement:**
- **Use:** `tests/scripts/e2e/test-improvement-comprehensive.sh`
- **Benefits:**
  - All features from this test included
  - Better API health checking
  - Improved workspace selection (prioritizes planner workspaces)
  - More robust error handling and validation
  - Enhanced logging and reporting
  - Cleaner code structure

**Original Test Coverage:**
1. API server running check
2. List and select workspace
3. Verify workspace configuration (project_id)
4. Trigger improvement workflow
5. Check plan status
6. Submit structured output
7. Verify structured output saved
8. **Edge cases:**
   - Empty content handling
   - Long content handling
   - Invalid plan ID handling
9. Frontend integration (manual verification steps)

**Unique Value (Lost in Replacement):**
- Manual frontend verification checklist
- Simpler output format (less verbose)

---

## 🔄 Migration Guide

### For Developers Who Used Legacy Tests

If you were using any of the archived tests, here's how to migrate:

#### From `test-improvement-workflow.sh`

```bash
# Old command
./tests/scripts/workflow/test-improvement-workflow.sh

# New command
./tests/scripts/e2e/test-improvement-comprehensive.sh
```

**Changes to Expect:**
- More verbose output (test tracking, pass/fail counters)
- Additional edge case tests (may take longer)
- Better error messages if tests fail
- Improved workspace selection (prioritizes planner workspaces)

#### From `test-improvement-end-to-end.sh`

```bash
# Old command
./tests/scripts/e2e/test-improvement-end-to-end.sh

# New command
./tests/scripts/e2e/test-improvement-comprehensive.sh
```

**Changes to Expect:**
- More comprehensive API health checking
- Better validation of responses
- Improved structured output verification
- Enhanced error handling

#### From `test-improvement-fix.sh`

```bash
# Old command
./test-improvement-fix.sh

# New command
./tests/scripts/e2e/test-improvement-comprehensive.sh
```

**Changes to Expect:**
- No automatic test data creation (requires existing workspace)
- Logging to stdout instead of `/tmp`
- Better test result tracking
- More comprehensive coverage

---

## 🔧 Restoration Instructions

**⚠️ WARNING:** Restoring legacy tests is not recommended unless absolutely necessary for rollback purposes.

### To Restore a Legacy Test

1. **Verify the Current Test Doesn't Meet Your Needs:**
   ```bash
   # Check what the current test covers
   ./tests/scripts/e2e/test-improvement-comprehensive.sh --help 2>&1 | head -20
   ```

2. **Copy the Legacy Test Back:**
   ```bash
   # Example: Restore test-improvement-workflow.sh
   cp tests/scripts/legacy/test-improvement-workflow.sh tests/scripts/workflow/
   chmod +x tests/scripts/workflow/test-improvement-workflow.sh
   ```

3. **Update the Legacy Header:**
   - Remove the "LEGACY" status from the header
   - Update the location in the documentation
   - Remove the archive date

4. **Test the Restored Script:**
   ```bash
   ./tests/scripts/workflow/test-improvement-workflow.sh
   ```

5. **Document the Restoration:**
   - Add a note to this README explaining why it was restored
   - Update the consolidation plan document
   - Notify the team

### Alternative: Extend the Current Test

Instead of restoring, consider extending `test-improvement-comprehensive.sh`:

```bash
# Edit the comprehensive test to add missing functionality
nano tests/scripts/e2e/test-improvement-comprehensive.sh
```

This is preferred over restoration because:
- Maintains single source of truth
- Avoids test duplication
- Keeps test suite organized

---

## 🗑️ Cleanup Policy

### Automatic Deletion Schedule

Legacy tests are retained for **6 months** from archive date:

| File | Archive Date | Deletion Date |
|------|-------------|---------------|
| `test-improvement-fix.sh` | 2025-03-19 | 2025-09-19 |
| `test-improvement-workflow.sh` | 2026-03-19 | 2026-09-19 |
| `test-improvement-end-to-end.sh` | 2026-03-19 | 2026-09-19 |

### Manual Deletion Criteria

A legacy test may be deleted earlier if:

1. ✅ **Current test has been stable for 3+ months** (no bugs reported)
2. ✅ **No team member has referenced the legacy test in 3+ months**
3. ✅ **Git history shows the legacy test hasn't been used in 6+ months**
4. ✅ **Team approves deletion** (consensus in pull request)

### Deletion Process

Before deleting a legacy test:

1. **Verify Deletion Criteria:**
   ```bash
   # Check when file was last referenced
   git log --all --full-history --oneline -- "**/test-improvement-workflow.sh"
   ```

2. **Create a Cleanup Issue:**
   ```markdown
   ## Delete Legacy Test: test-improvement-workflow.sh

   - [ ] Last referenced: [date]
   - [ ] No bugs in replacement test for 3+ months
   - [ ] Team approval obtained
   - [ ] Update consolidation plan
   ```

3. **Delete and Update Documentation:**
   ```bash
   git rm tests/scripts/legacy/test-improvement-workflow.sh
   # Update this README to remove the file
   git commit -m "Delete legacy test: test-improvement-workflow.sh"
   ```

---

## 📊 Consolidation Results

### Before Consolidation (2026-03-19)

- **Total improvement workflow tests:** 3 files
- **Redundant tests:** 2 files (workflow + end-to-end)
- **Code duplication:** ~80% overlap
- **Maintenance burden:** High (3 files to update)

### After Consolidation (2026-03-19)

- **Total improvement workflow tests:** 1 active file
- **Redundant tests:** 0 files
- **Code duplication:** 0%
- **Maintenance burden:** Low (single source of truth)

### Test Coverage Comparison

| Feature | test-improvement-workflow.sh | test-improvement-end-to-end.sh | test-improvement-comprehensive.sh |
|---------|----------------------------|-------------------------------|----------------------------------|
| API health check | ✅ | ✅ | ✅ (Enhanced) |
| Workspace listing | ✅ | ✅ | ✅ (Better output) |
| Workspace selection | Basic | Basic | ✅ (Prioritizes planner) |
| Create improvement | ✅ | ✅ | ✅ |
| Plan status monitoring | ✅ | ✅ | ✅ |
| Submit structured output | ✅ | ✅ | ✅ |
| Verify structured output | ✅ | ✅ | ✅ (Enhanced) |
| Empty content edge case | ❌ | ✅ | ✅ |
| Long content edge case | ❌ | ✅ | ✅ |
| Invalid plan ID edge case | ❌ | ✅ | ✅ |
| Test result tracking | ❌ | ✅ | ✅ |
| Frontend verification guide | ❌ | ✅ | ✅ |
| Cleanup on exit | ✅ | ❌ | ✅ |
| **Total Tests** | 6 | 7+ | **11** |

---

## 📝 Maintenance Notes

### When to Update This README

Update this document when:

1. **A new test is archived:** Add to "Archived Files" section
2. **A legacy test is restored:** Update status and migration guide
3. **A legacy test is deleted:** Remove from "Archived Files" section
4. **The replacement test changes:** Update migration guide

### Related Documentation

- **Consolidation Plan:** `docs/testing/consolidation-plan.md`
- **Test Inventory:** `docs/testing/test-inventory.md`
- **Main Test README:** `tests/README.md`

### Questions or Issues?

If you have questions about legacy tests or the consolidation:

1. Check the consolidation plan: `docs/testing/consolidation-plan.md`
2. Review the current replacement test
3. Ask the team in a pull request or issue

---

**Last Updated:** 2026-03-19
**Maintained By:** Development Team
**Next Review:** 2026-09-19 (before deletion)
