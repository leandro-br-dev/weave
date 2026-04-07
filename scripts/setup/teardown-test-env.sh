#!/bin/bash

###############################################################################
# Teardown Test Environment Script
#
# This script cleans up test environments after test runs.
# It removes test databases, cleans up temporary files, and
# stops test containers.
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
echo -e "${BLUE}Tearing Down Test Environments${NC}"
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

cleanup_test_databases() {
    log_info "Cleaning up test databases..."

    local test_db_files=(
        "api/data/test-database.db"
        "api/data/test-database.db-shm"
        "api/data/test-database.db-wal"
        "/tmp/weave-test.db"
    )

    for db_file in "${test_db_files[@]}"; do
        if [ -f "$db_file" ]; then
            rm -f "$db_file"
            log_info "Removed: $db_file"
        fi
    done

    log_info "Test databases cleaned up"
}

cleanup_test_directories() {
    log_info "Cleaning up test directories..."

    local test_dirs=(
        "/tmp/test-projects"
        "/tmp/test-workspaces"
        "/tmp/test-agent-client"
        "/tmp/test-logs"
    )

    for dir in "${test_dirs[@]}"; do
        if [ -d "$dir" ]; then
            rm -rf "$dir"
            log_info "Removed: $dir"
        fi
    done

    log_info "Test directories cleaned up"
}

cleanup_test_logs() {
    log_info "Cleaning up test logs..."

    # Clean up pytest cache
    if [ -d ".pytest_cache" ]; then
        rm -rf .pytest_cache
        log_info "Removed: .pytest_cache"
    fi

    # Clean up coverage reports
    find . -type d -name "coverage" -exec rm -rf {} + 2>/dev/null || true
    find . -type d -name ".nyc_output" -exec rm -rf {} + 2>/dev/null || true

    log_info "Test logs cleaned up"
}

cleanup_python_cache() {
    log_info "Cleaning up Python cache..."

    find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find . -type f -name "*.pyc" -delete 2>/dev/null || true
    find . -type f -name ".pytest_cache" -delete 2>/dev/null || true

    log_info "Python cache cleaned up"
}

cleanup_node_modules() {
    log_info "Cleaning up test artifacts..."

    # Clean up build artifacts
    find . -type d -name "dist" -path "*/tests/*" -exec rm -rf {} + 2>/dev/null || true
    find . -type d -name "build" -path "*/tests/*" -exec rm -rf {} + 2>/dev/null || true

    log_info "Test artifacts cleaned up"
}

teardown_docker_test_env() {
    if command -v docker &> /dev/null && [ -f "docker-compose.test.yml" ]; then
        log_info "Tearing down Docker test environment..."

        # Stop and remove test containers
        docker-compose -f docker-compose.test.yml down -v 2>/dev/null || log_warn "Failed to stop test containers"

        log_info "Docker test environment torn down"
    else
        log_warn "Docker not available or docker-compose.test.yml not found, skipping..."
    fi

    # Clean up any test containers that might still be running
    if command -v docker &> /dev/null; then
        docker ps -q --filter "name=weave-test" | xargs -r docker stop 2>/dev/null || true
        docker ps -aq --filter "name=weave-test" | xargs -r docker rm 2>/dev/null || true
    fi
}

cleanup_temp_files() {
    log_info "Cleaning up temporary files..."

    # Clean up test temp directories
    find /tmp -type d -name "weave-test-*" -exec rm -rf {} + 2>/dev/null || true
    find /tmp -type f -name "test-*.db" -delete 2>/dev/null || true

    log_info "Temporary files cleaned up"
}

reset_environment_variables() {
    log_info "Resetting environment variables..."

    # Unset test-specific environment variables
    unset TEST_DB_PATH 2>/dev/null || true
    unset TEST_API_URL 2>/dev/null || true
    unset TEST_API_TOKEN 2>/dev/null || true
    unset NODE_ENV 2>/dev/null || true

    log_info "Environment variables reset"
}

print_summary() {
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Test Environment Teardown Complete${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Cleaned up:"
    echo "  - Test databases"
    echo "  - Test directories"
    echo "  - Test logs"
    echo "  - Python cache"
    echo "  - Test artifacts"
    echo "  - Docker containers"
    echo "  - Temporary files"
    echo ""
}

###############################################################################
# Main execution
###############################################################################

main() {
    cleanup_test_databases
    cleanup_test_directories
    cleanup_test_logs
    cleanup_python_cache
    cleanup_node_modules
    teardown_docker_test_env
    cleanup_temp_files
    reset_environment_variables
    print_summary
}

# Run main function
main "$@"
