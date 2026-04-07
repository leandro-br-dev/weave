#!/bin/bash

###############################################################################
# Setup Test Environment Script
#
# This script sets up isolated test environments for all test types.
# It creates test databases, configures environment variables, and
# prepares test fixtures.
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
echo -e "${BLUE}Setting up Test Environments${NC}"
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

create_test_directories() {
    log_info "Creating test directories..."

    mkdir -p /tmp/test-projects
    mkdir -p /tmp/test-workspaces
    mkdir -p /tmp/test-agent-client
    mkdir -p /tmp/test-logs
    mkdir -p api/data
    mkdir -p tests/fixtures

    log_info "Test directories created"
}

setup_python_test_env() {
    log_info "Setting up Python test environment..."

    # Create test .env file if it doesn't exist
    if [ ! -f "tests/.env.test" ]; then
        log_warn "tests/.env.test not found, creating from template..."
        cat > tests/.env.test << 'EOF'
# Python Test Environment Configuration
TEST_DB_PATH=/tmp/weave-test.db
TEST_API_URL=http://localhost:3000
TEST_API_TOKEN=test-token-for-testing-only
TEST_TIMEOUT=30
TEST_CLEANUP_ENABLED=true
EOF
    fi

    # Install Python test dependencies
    if [ -f "requirements-test.txt" ]; then
        log_info "Installing Python test dependencies..."
        pip3 install -q -r requirements-test.txt || log_warn "Failed to install Python test dependencies"
    fi

    log_info "Python test environment ready"
}

setup_api_test_env() {
    log_info "Setting up API test environment..."

    # Create test .env file if it doesn't exist
    if [ ! -f "api/.env.test" ]; then
        log_warn "api/.env.test not found, creating from template..."
        cat > api/.env.test << 'EOF'
# API Test Environment Configuration
PORT=3001
API_BEARER_TOKEN=test-token-for-testing-only
DATABASE_URL=./api/data/test-database.db
NODE_ENV=test
TEST_CLEANUP_ENABLED=true
EOF
    fi

    # Install API test dependencies
    if [ -f "api/package.json" ]; then
        log_info "Installing API test dependencies..."
        cd api
        npm install --silent 2>/dev/null || log_warn "Failed to install API test dependencies"
        cd "$PROJECT_ROOT"
    fi

    log_info "API test environment ready"
}

setup_dashboard_test_env() {
    log_info "Setting up Dashboard test environment..."

    # Create test .env file if it doesn't exist
    if [ ! -f "dashboard/.env.test" ]; then
        log_warn "dashboard/.env.test not found, creating from template..."
        cat > dashboard/.env.test << 'EOF'
# Dashboard Test Environment Configuration
VITE_API_URL=http://localhost:3001
VITE_API_TOKEN=test-token-for-testing-only
NODE_ENV=test
VITE_TEST_TIMEOUT=10000
EOF
    fi

    # Install Dashboard test dependencies
    if [ -f "dashboard/package.json" ]; then
        log_info "Installing Dashboard test dependencies..."
        cd dashboard
        npm install --silent 2>/dev/null || log_warn "Failed to install Dashboard test dependencies"
        cd "$PROJECT_ROOT"
    fi

    log_info "Dashboard test environment ready"
}

setup_integration_test_env() {
    log_info "Setting up Integration test environment..."

    # Create test .env file if it doesn't exist
    if [ ! -f "tests/integration/.env.test" ]; then
        log_warn "tests/integration/.env.test not found, creating from template..."
        cat > tests/integration/.env.test << 'EOF'
# Integration Test Environment Configuration
API_URL=http://localhost:3001
AUTH_TOKEN=test-token-for-testing-only
TEST_DB_PATH=./api/data/test-database.db
CLEANUP_AFTER_TEST=true
SEED_TEST_DATA=true
EOF
    fi

    log_info "Integration test environment ready"
}

setup_test_databases() {
    log_info "Setting up test databases..."

    # Create test database directory
    mkdir -p api/data

    # Copy production database to test database if it exists
    if [ -f "api/data/database.db" ] && [ ! -f "api/data/test-database.db" ]; then
        log_info "Creating test database from production schema..."
        cp api/data/database.db api/data/test-database.db
    fi

    log_info "Test databases ready"
}

setup_docker_test_env() {
    if command -v docker &> /dev/null && [ -f "docker-compose.test.yml" ]; then
        log_info "Setting up Docker test environment..."

        # Start test containers
        docker-compose -f docker-compose.test.yml up -d 2>/dev/null || log_warn "Failed to start test containers"

        # Wait for containers to be ready
        sleep 5

        log_info "Docker test environment ready"
    else
        log_warn "Docker not available or docker-compose.test.yml not found, skipping..."
    fi
}

verify_setup() {
    log_info "Verifying test environment setup..."

    local errors=0

    # Check test directories
    if [ ! -d "/tmp/test-projects" ]; then
        log_error "Test projects directory not found"
        errors=$((errors + 1))
    fi

    # Check test env files
    if [ ! -f "tests/.env.test" ]; then
        log_error "Python test .env not found"
        errors=$((errors + 1))
    fi

    if [ ! -f "api/.env.test" ]; then
        log_error "API test .env not found"
        errors=$((errors + 1))
    fi

    if [ ! -f "dashboard/.env.test" ]; then
        log_error "Dashboard test .env not found"
        errors=$((errors + 1))
    fi

    if [ $errors -eq 0 ]; then
        log_info "Test environment setup verified successfully"
    else
        log_error "Test environment setup verification failed with $errors errors"
        return 1
    fi
}

print_summary() {
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Test Environment Setup Complete${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Test environments configured:"
    echo "  - Python:      tests/.env.test"
    echo "  - API:         api/.env.test"
    echo "  - Dashboard:   dashboard/.env.test"
    echo "  - Integration: tests/integration/.env.test"
    echo ""
    echo "Test directories:"
    echo "  - /tmp/test-projects"
    echo "  - /tmp/test-workspaces"
    echo "  - /tmp/test-agent-client"
    echo "  - /tmp/test-logs"
    echo ""
    echo "To run tests:"
    echo "  - All tests:     npm run test:all"
    echo "  - Python tests:  pytest"
    echo "  - API tests:     npm run test:api"
    echo "  - Dashboard:     npm run test:dashboard"
    echo ""
}

###############################################################################
# Main execution
###############################################################################

main() {
    create_test_directories
    setup_python_test_env
    setup_api_test_env
    setup_dashboard_test_env
    setup_integration_test_env
    setup_test_databases
    setup_docker_test_env
    verify_setup
    print_summary
}

# Run main function
main "$@"
