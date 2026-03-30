.PHONY: help install dev build test test-unit test-integration test-coverage test-watch test-clean test-setup test-teardown test-reset-db lint format test-e2e test-workflow test-manual test-improvement test-legacy

# Default target
.DEFAULT_GOAL := help

# Variables
NODE_BIN := node
NPM_BIN := npm
PYTHON_BIN := python3

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)Agents Manager - Available Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""

install: ## Install all dependencies
	@echo "$(BLUE)Installing dependencies...$(NC)"
	@$(NPM_BIN) run install:all

dev: ## Start development servers for both API and Dashboard
	@echo "$(BLUE)Starting development servers...$(NC)"
	@$(NPM_BIN) run dev

build: ## Build all packages
	@echo "$(BLUE)Building packages...$(NC)"
	@$(NPM_BIN) run build:all

test: ## Run all tests
	@echo "$(BLUE)Running all tests...$(NC)"
	@$(NPM_BIN) test

test-unit: ## Run unit tests only
	@echo "$(BLUE)Running unit tests...$(NC)"
	@$(NPM_BIN) run test:unit

test-integration: ## Run integration tests only
	@echo "$(BLUE)Running integration tests...$(NC)"
	@$(NPM_BIN) run test:integration

test-python: ## Run Python tests
	@echo "$(BLUE)Running Python tests...$(NC)"
	@$(NPM_BIN) run test:python

test-api: ## Run API tests
	@echo "$(BLUE)Running API tests...$(NC)"
	@$(NPM_BIN) run test:api

test-dashboard: ## Run Dashboard tests
	@echo "$(BLUE)Running Dashboard tests...$(NC)"
	@$(NPM_BIN) run test:dashboard

test-coverage: ## Generate coverage reports for all tests
	@echo "$(BLUE)Generating coverage reports...$(NC)"
	@$(NPM_BIN) run test:coverage

test-watch: ## Run tests in watch mode
	@echo "$(BLUE)Starting test watch mode...$(NC)"
	@$(NPM_BIN) run test:watch

test-clean: ## Clean test artifacts and coverage reports
	@echo "$(BLUE)Cleaning test artifacts...$(NC)"
	@$(NPM_BIN) run test:clean

test-setup: ## Set up test environments
	@echo "$(BLUE)Setting up test environments...$(NC)"
	@$(NPM_BIN) run test:setup

test-teardown: ## Tear down test environments
	@echo "$(BLUE)Tearing down test environments...$(NC)"
	@$(NPM_BIN) run test:teardown

test-reset-db: ## Reset test databases
	@echo "$(BLUE)Resetting test databases...$(NC)"
	@$(NPM_BIN) run test:reset-db

test-ci: ## Run tests in CI mode
	@echo "$(BLUE)Running tests in CI mode...$(NC)"
	@$(NPM_BIN) run test:ci

# E2E and workflow test targets
test-e2e: ## Run comprehensive end-to-end tests
	@echo "$(BLUE)Running comprehensive end-to-end tests...$(NC)"
	@./tests/scripts/e2e/test-improvement-comprehensive.sh

test-workflow: ## Run workflow automation tests
	@echo "$(BLUE)Running workflow tests...$(NC)"
	@echo "$(YELLOW)Running improvement workflow test...$(NC)"
	@./tests/scripts/workflow/test-improvement-workflow.sh
	@echo "$(YELLOW)Running structured output race condition test...$(NC)"
	@./tests/scripts/workflow/test-structured-output-race-condition.sh
	@echo "$(YELLOW)Running structured output fix test...$(NC)"
	@./tests/scripts/workflow/test-structured-output-fix.sh

test-scripts: ## Run all script-based tests
	@echo "$(BLUE)Running all script-based tests...$(NC)"
	@echo "$(YELLOW)Running comprehensive E2E tests...$(NC)"
	@./tests/scripts/e2e/test-improvement-comprehensive.sh
	@echo "$(YELLOW)Running workflow tests...$(NC)"
	@./tests/scripts/workflow/test-improvement-workflow.sh
	@./tests/scripts/workflow/test-structured-output-race-condition.sh
	@./tests/scripts/workflow/test-structured-output-fix.sh

test-manual: ## Run manual test guide (interactive)
	@echo "$(BLUE)Starting manual test guide...$(NC)"
	@./tests/scripts/manual/test-improvement-manual.sh

test-improvement: ## Run all improvement-related tests
	@echo "$(BLUE)Running all improvement tests...$(NC)"
	@$(MAKE) test-scripts

test-legacy: ## Run legacy tests (for reference)
	@echo "$(YELLOW)Running legacy tests...$(NC)"
	@./tests/scripts/legacy/test-improvement-fix.sh

lint: ## Run linting for all packages
	@echo "$(BLUE)Linting code...$(NC)"
	@echo "$(YELLOW)⚠ Lint command not yet configured$(NC)"

format: ## Format code for all packages
	@echo "$(BLUE)Formatting code...$(NC)"
	@echo "$(YELLOW)⚠ Format command not yet configured$(NC)"

# Quick development targets
dev-api: ## Start API development server only
	@echo "$(BLUE)Starting API development server...$(NC)"
	@$(NPM_BIN) run dev:api

dev-dashboard: ## Start Dashboard development server only
	@echo "$(BLUE)Starting Dashboard development server...$(NC)"
	@$(NPM_BIN) run dev:dashboard

# Database targets
db-up: ## Start database containers
	@echo "$(BLUE)Starting database containers...$(NC)"
	@docker-compose -f docker-compose.test.yml up -d

db-down: ## Stop database containers
	@echo "$(BLUE)Stopping database containers...$(NC)"
	@docker-compose -f docker-compose.test.yml down

db-reset: ## Reset database containers
	@echo "$(BLUE)Resetting database containers...$(NC)"
	@$(MAKE) db-down
	@$(MAKE) db-up

# CI/CD targets
ci: test-ci ## Alias for test-ci

ci-coverage: test-coverage ## Alias for test-coverage

# Utility targets
clean-all: test-clean ## Clean all artifacts (node_modules, builds, test artifacts)
	@echo "$(BLUE)Cleaning all artifacts...$(NC)"
	@rm -rf node_modules api/node_modules dashboard/node_modules
	@rm -rf api/dist dashboard/dist
	@echo "$(GREEN)✓ Cleaned all artifacts$(NC)"

fresh: clean-all install ## Clean everything and install from scratch
	@echo "$(GREEN)✓ Fresh install complete$(NC)"
