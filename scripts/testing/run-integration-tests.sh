#!/bin/bash

# Integration Test Runner Script
#
# Usage:
#   ./run-integration-tests.sh                    # Run all integration tests
#   ./run-integration-tests.sh --kanban          # Run only kanban tests
#   ./run-integration-tests.sh --agents          # Run only agents tests
#   ./run-integration-tests.sh --file <pattern>  # Run tests matching pattern
#   ./run-integration-tests.sh --dry-run         # Show what would run without running
#   ./run-integration-tests.sh --no-cleanup      # Don't cleanup after tests

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."  # Go to project root

# Run the TypeScript test runner
tsx tests/run-integration-tests.ts "$@"
