#!/bin/bash

###############################################################################
# Reset Test Database Script
#
# This script resets test databases to a clean state.
# It's useful to run between test suites to ensure test isolation.
###############################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Resetting Test Databases${NC}"
echo -e "${BLUE}========================================${NC}"

###############################################################################
# Functions
###############################################################################

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

reset_python_test_db() {
    log_info "Resetting Python test database..."

    local test_db="/tmp/weave-test.db"

    if [ -f "$test_db" ]; then
        rm -f "$test_db"
        log_info "Removed: $test_db"
    fi

    # Create fresh test database
    sqlite3 "$test_db" << 'EOF'
-- Create test database schema
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    project_id TEXT NOT NULL,
    path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kanban_tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    column TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 3,
    pipeline_status TEXT NOT NULL DEFAULT 'idle',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_agents (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    agent_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'idle',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
EOF

    log_info "Python test database reset complete"
}

reset_api_test_db() {
    log_info "Resetting API test database..."

    local test_db="api/data/test-database.db"

    if [ -f "$test_db" ]; then
        rm -f "$test_db"
        log_info "Removed: $test_db"
    fi

    # Copy from production database if it exists
    if [ -f "api/data/database.db" ]; then
        cp api/data/database.db "$test_db"
        log_info "Created test database from production schema"
    else
        # Create fresh test database
        mkdir -p api/data
        sqlite3 "$test_db" << 'EOF'
-- Create test database schema
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    project_id TEXT NOT NULL,
    path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kanban_tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    column TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 3,
    pipeline_status TEXT NOT NULL DEFAULT 'idle',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_agents (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    agent_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'idle',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
EOF
        log_info "Created fresh test database"
    fi

    log_info "API test database reset complete"
}

seed_test_data() {
    log_info "Seeding test data..."

    local test_db="api/data/test-database.db"

    if [ ! -f "$test_db" ]; then
        log_warn "Test database not found, skipping data seeding"
        return
    fi

    # Seed some test data
    sqlite3 "$test_db" << 'EOF'
-- Insert test projects
INSERT OR REPLACE INTO projects (id, name, description, created_at, updated_at)
VALUES
    ('test-project-1', 'Test Project 1', 'A test project for integration tests', datetime('now'), datetime('now')),
    ('test-project-2', 'Test Project 2', 'Another test project', datetime('now'), datetime('now'));

-- Insert test workspaces
INSERT OR REPLACE INTO workspaces (id, name, project_id, path, created_at, updated_at)
VALUES
    ('test-workspace-1', 'Test Workspace 1', 'test-project-1', '/tmp/test-workspace-1', datetime('now'), datetime('now')),
    ('test-workspace-2', 'Test Workspace 2', 'test-project-2', '/tmp/test-workspace-2', datetime('now'), datetime('now'));
EOF

    log_info "Test data seeded successfully"
}

cleanup_wal_files() {
    log_info "Cleaning up WAL files..."

    # Clean up SQLite WAL files
    find api/data -name "*.db-wal" -delete 2>/dev/null || true
    find api/data -name "*.db-shm" -delete 2>/dev/null || true
    find /tmp -name "weave-test.db-wal" -delete 2>/dev/null || true
    find /tmp -name "weave-test.db-shm" -delete 2>/dev/null || true

    log_info "WAL files cleaned up"
}

print_summary() {
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Test Database Reset Complete${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Reset databases:"
    echo "  - Python test database: /tmp/weave-test.db"
    echo "  - API test database:    api/data/test-database.db"
    echo ""
    echo "Test databases are now ready for testing"
    echo ""
}

###############################################################################
# Main execution
###############################################################################

main() {
    reset_python_test_db
    reset_api_test_db
    seed_test_data
    cleanup_wal_files
    print_summary
}

# Run main function
main "$@"
