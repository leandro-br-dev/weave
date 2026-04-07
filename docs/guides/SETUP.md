# Documentation Enforcement Setup

## Overview

This project uses automated checks to ensure documentation follows the established guidelines and prevent `.md` files from accumulating in the project root directory.

## Problem Statement

Previously, the project had **50+ `.md` files scattered in the root directory**, making it difficult to:
- Find important files
- Maintain project organization
- Follow documentation best practices
- Onboard new developers

After implementing the guidelines, we reduced this to just **2 files** (`README.md` and `FILE_MIGRATION_README.md`).

## Solution: Automated Pre-Commit Checks

We've implemented a multi-layered verification system:

### 1. **Check Script** (`/scripts/devtools/check-root-md.sh`)

A bash script that:
- ✅ Scans the project root for `.md` files
- ✅ Allows only `README.md` in the root
- ❌ Blocks commits if other `.md` files are found
- 📋 Provides clear guidance on where to move files

**Features:**
- Color-coded output (red for errors, green for success)
- Lists all violating files with sizes
- Shows recommended directory structure
- Suggests quick fix commands

### 2. **NPM Scripts** (in `package.json`)

```json
{
  "scripts": {
    "check:docs": "./scripts/devtools/check-root-md.sh",
    "precommit": "npm run check:docs"
  }
}
```

**Usage:**
```bash
# Manual check
npm run check:docs

# Run via pre-commit hook (automatic)
git commit -m "your message"
```

### 3. **Git Hooks** (via Husky)

Automatically runs the check before every commit:
```bash
.husky/pre-commit → npm run check:docs
```

## Installation

### Option 1: Automatic Setup (Recommended)

Run the setup script:
```bash
./scripts/setup/setup-docs-hook.sh
```

This will:
1. Install husky as a dev dependency (if not already installed)
2. Initialize husky in your project
3. Create the pre-commit hook
4. Make everything executable

### Option 2: Manual Setup

1. **Install Husky:**
   ```bash
   npm install --save-dev husky
   ```

2. **Initialize Husky:**
   ```bash
   npx husky install
   ```

3. **Create Pre-Commit Hook:**
   ```bash
   cat > .husky/pre-commit << 'EOF'
   #!/bin/sh
   . "$(dirname "$0")/_/husky.sh"

   echo "🔍 Running documentation checks..."
   npm run check:docs
   EOF

   chmod +x .husky/pre-commit
   ```

## Usage

### Everyday Development

The check runs **automatically** on every commit. No action needed!

```bash
# This will automatically run the documentation check
git add .
git commit -m "Add new feature"
```

### Manual Verification

You can also run the check manually at any time:

```bash
npm run check:docs
```

### Bypassing the Hook (Not Recommended)

In rare cases where you need to bypass the check:

```bash
git commit --no-verify -m "Emergency fix"
```

⚠️ **Warning:** Use `--no-verify` only in emergencies. Always fix violations afterward.

## How It Works

### Check Process Flow

```
1. User runs: git commit
   ↓
2. Git triggers: .husky/pre-commit
   ↓
3. Hook executes: npm run check:docs
   ↓
4. NPM script runs: ./scripts/devtools/check-root-md.sh
   ↓
5. Script scans root for .md files
   ↓
6a. If violations found:
    - Lists all violating files
    - Shows guidance
    - Exits with error (1)
    - ❌ Commit is BLOCKED
   ↓
6b. If no violations:
    - Shows success message
    - Exits with success (0)
    - ✅ Commit proceeds
```

### Allowed Files

✅ **Allowed in root:**
- `README.md` (project overview)
- `LICENSE` (if applicable)

❌ **NOT allowed in root:**
- Test reports
- Implementation docs
- Feature specs
- Architecture docs
- Any other `.md` files

## Testing the Setup

### Test 1: Verify Script Works

```bash
# Should PASS (no violations)
npm run check:docs

# Create a test file
touch TEST.md

# Should FAIL (violation found)
npm run check:docs

# Clean up
rm TEST.md

# Should PASS again
npm run check:docs
```

### Test 2: Verify Git Hook Works

```bash
# Create a test file
touch VIOLATION.md

# Try to commit (should be BLOCKED)
git add VIOLATION.md
git commit -m "Test violation"

# Clean up and try again
rm VIOLATION.md
git add .
git commit -m "Clean up test file"
```

## Troubleshooting

### Hook Not Running

**Problem:** Commits succeed even with `.md` files in root.

**Solutions:**

1. **Check if husky is installed:**
   ```bash
   npm list husky
   ```

2. **Verify hook exists:**
   ```bash
   ls -la .husky/pre-commit
   ```

3. **Check hook permissions:**
   ```bash
   chmod +x .husky/pre-commit
   ```

4. **Reinstall husky:**
   ```bash
   npm uninstall husky
   ./scripts/setup/setup-docs-hook.sh
   ```

### Script Permission Denied

**Problem:** `Permission denied` when running the script.

**Solution:**
```bash
chmod +x scripts/devtools/check-root-md.sh
```

### False Positives

**Problem:** Script reports violations for valid files.

**Solution:**
Edit `scripts/devtools/check-root-md.sh` and add exceptions to the find command:
```bash
find "$PROJECT_ROOT" -maxdepth 1 -name '*.md' -type f \
  ! -name 'README.md' \
  ! -name 'YOUR_EXCEPTION.md' \
  ! -name 'ANOTHER_EXCEPTION.md'
```

## File Structure

```
weave/
├── scripts/
│   ├── devtools/
│   │   └── check-root-md.sh      # Main verification script
│   └── setup/
│       └── setup-docs-hook.sh    # Automatic setup script
├── .husky/
│   └── pre-commit                # Git hook (auto-generated)
├── package.json                  # Contains npm scripts
└── docs/
    ├── DOCUMENTATION_GUIDELINES.md   # Guidelines being enforced
    └── SETUP.md                      # This file
```

## Best Practices

### 1. **Commit Frequently**
The hook catches violations early, preventing accumulation of files in the wrong location.

### 2. **Read Error Messages**
When the hook fails, read the guidance carefully. It tells you exactly where to move files.

### 3. **Update Guidelines First**
If you need to add new document types, update `DOCUMENTATION_GUIDELINES.md` first, then move files accordingly.

### 4. **Review Proposed Changes**
Before committing, review what you're about to commit:
```bash
git diff --cached --name-only
```

### 5. **Fix Violations Immediately**
Don't use `--no-verify`. Fix the issue properly by moving files to the correct location.

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Documentation Check

on: [push, pull_request]

jobs:
  check-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run documentation check
        run: npm run check:docs
```

### Pre-Commit CI Integration

You can also use [pre-commit.ci](https://pre-commit.ci/) for automatic checks on pull requests.

## Maintenance

### Updating the Script

If you need to modify the check logic:

1. Edit `scripts/devtools/check-root-md.sh`
2. Test manually: `./scripts/devtools/check-root-md.sh`
3. Test with violations: `touch TEST.md && ./scripts/devtools/check-root-md.sh`
4. Commit your changes

### Adding New File Types

To check for other file types (e.g., `.txt` files):

```bash
# In check-root-md.sh, change:
ROOT_MD_FILES=$(find "$PROJECT_ROOT" -maxdepth 1 -name '*.md' -type f ! -name 'README.md')

# To:
ROOT_MD_FILES=$(find "$PROJECT_ROOT" -maxdepth 1 -type f \( -name '*.md' ! -name 'README.md' \) -o \( -name '*.txt' ! -name 'README.txt' \))
```

## Success Metrics

### Before Implementation
- **50+ `.md` files** in root directory
- Inconsistent file organization
- Difficult to find documentation
- Poor onboarding experience

### After Implementation
- **Only 2 `.md` files** in root (README.md + migration guide)
- Clear file organization under `/docs/`
- Easy to find documentation
- Better onboarding experience
- **Automated enforcement** prevents regression

## Additional Resources

- **Documentation Guidelines:** `/docs/DOCUMENTATION_GUIDELINES.md`
- **Project README:** `/README.md`
- **Husky Documentation:** https://typicode.github.io/husky/
- **Bash Scripting Guide:** https://www.gnu.org/software/bash/manual/

## FAQ

**Q: Can I disable the hook temporarily?**
A: Yes, use `git commit --no-verify`, but this is not recommended. Fix violations instead.

**Q: What if I need a `.md` file in the root for a specific reason?**
A: Edit `scripts/devtools/check-root-md.sh` to add an exception for that file.

**Q: Does this work with all operating systems?**
A: Yes, the script uses POSIX-compliant commands that work on Linux, macOS, and WSL.

**Q: Can I customize the error messages?**
A: Yes, edit `scripts/devtools/check-root-md.sh` and modify the echo statements.

**Q: How do I check if the hook is working?**
A: Run `npm run check:docs` or create a test `.md` file and try to commit.

## Support

For issues or questions:
1. Check this documentation
2. Review `/docs/DOCUMENTATION_GUIDELINES.md`
3. Ask the team in project communication channels

---

**Version:** 1.0.0
**Last Updated:** 2026-03-19
**Maintained By:** Development Team
