#!/usr/bin/env tsx

/**
 * Integration Test Runner
 *
 * @description Root-level test runner script for integration tests.
 *              Handles environment setup, test execution, and cleanup.
 *
 * @usage
 *   tsx run-integration-tests.ts                    # Run all integration tests
 *   tsx run-integration-tests.ts --kanban          # Run only kanban tests
 *   tsx run-integration-tests.ts --agents          # Run only agents tests
 *   tsx run-integration-tests.ts --file <pattern>  # Run tests matching pattern
 *   tsx run-integration-tests.ts --dry-run         # Show what would run without running
 *   tsx run-integration-tests.ts --no-cleanup      # Don't cleanup after tests
 *
 * @options
 *   --kanban       Run kanban integration tests
 *   --agents       Run agents integration tests
 *   --file <path>  Run specific test file
 *   --dry-run      Show test plan without executing
 *   --no-cleanup   Skip cleanup after tests
 *   --verbose      Enable verbose logging
 *   --help         Show help message
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

interface TestRunnerConfig {
  testType?: 'kanban' | 'agents' | 'all'
  filePattern?: string
  dryRun: boolean
  cleanup: boolean
  verbose: boolean
}

const CONFIG: TestRunnerConfig = {
  testType: 'all',
  dryRun: false,
  cleanup: true,
  verbose: false
}

// Parse command line arguments
const args = process.argv.slice(2)
for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  switch (arg) {
    case '--kanban':
      CONFIG.testType = 'kanban'
      break
    case '--agents':
      CONFIG.testType = 'agents'
      break
    case '--file':
      CONFIG.filePattern = args[++i]
      break
    case '--dry-run':
      CONFIG.dryRun = true
      break
    case '--no-cleanup':
      CONFIG.cleanup = false
      break
    case '--verbose':
      CONFIG.verbose = true
      break
    case '--help':
      showHelp()
      process.exit(0)
    default:
      console.error(`Unknown argument: ${arg}`)
      showHelp()
      process.exit(1)
  }
}

function showHelp() {
  console.log(`
Integration Test Runner
=======================

Usage:
  tsx run-integration-tests.ts [options]

Options:
  --kanban           Run kanban integration tests
  --agents           Run agents integration tests
  --file <pattern>   Run tests matching file pattern
  --dry-run          Show test plan without executing
  --no-cleanup       Skip cleanup after tests
  --verbose          Enable verbose logging
  --help             Show this help message

Examples:
  tsx run-integration-tests.ts                    # Run all integration tests
  tsx run-integration-tests.ts --kanban          # Run only kanban tests
  tsx run-integration-tests.ts --agents          # Run only agents tests
  tsx run-integration-tests.ts --file auto-move  # Run tests matching pattern
  tsx run-integration-tests.ts --dry-run         # Show what would run
  `)
}

function log(message: string, ...args: any[]) {
  console.log(`\x1b[36m[TEST RUNNER]\x1b[0m ${message}`, ...args)
}

function success(message: string, ...args: any[]) {
  console.log(`\x1b[32m✓ ${message}\x1b[0m`, ...args)
}

function error(message: string, ...args: any[]) {
  console.log(`\x1b[31m✗ ${message}\x1b[0m`, ...args)
}

function warn(message: string, ...args: any[]) {
  console.log(`\x1b[33m⚠ ${message}\x1b[0m`, ...args)
}

function info(message: string, ...args: any[]) {
  console.log(`\x1b[33mℹ ${message}\x1b[0m`, ...args)
}

/**
 * Discover integration test files
 */
function discoverTestFiles(): string[] {
  const integrationDir = path.join(process.cwd(), 'tests/integration')
  const testFiles: string[] = []

  function scanDirectory(dir: string, pattern?: string) {
    if (!fs.existsSync(dir)) {
      warn('Directory not found:', dir)
      return
    }

    const files = fs.readdirSync(dir, { recursive: true }) as string[]

    for (const file of files) {
      const fullPath = path.join(dir, file)

      // Skip directories
      if (fs.statSync(fullPath).isDirectory()) {
        continue
      }

      // Check if it's a test file
      if (file.endsWith('.test.ts') || file.endsWith('.test.mjs')) {
        // Apply filters
        if (CONFIG.testType === 'kanban' && !fullPath.includes('/kanban/')) {
          continue
        }
        if (CONFIG.testType === 'agents' && !fullPath.includes('/agents/')) {
          continue
        }
        if (pattern && !file.includes(pattern)) {
          continue
        }

        testFiles.push(fullPath)
      }
    }
  }

  scanDirectory(integrationDir, CONFIG.filePattern)
  return testFiles.sort()
}

/**
 * Check if API server is running
 */
function checkApiServer(): boolean {
  try {
    const response = execSync('curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health', {
      stdio: 'pipe',
      timeout: 2000
    })
    return response.toString().includes('200')
  } catch {
    return false
  }
}

/**
 * Setup test environment
 */
function setupTestEnvironment(): void {
  log('Setting up test environment...')

  // Check if API server is running
  if (!checkApiServer()) {
    error('API server is not running on http://localhost:3000')
    info('Please start the API server first:')
    info('  cd api && npm start')
    info('  OR for development: cd api && npm run dev')
    process.exit(1)
  }

  success('API server is running')

  // Seed test data if needed
  const seedScript = path.join(process.cwd(), 'tests/integration/seed-test-data.ts')
  if (fs.existsSync(seedScript)) {
    log('Seeding test data...')
    try {
      execSync(`tsx ${seedScript}`, { stdio: CONFIG.verbose ? 'inherit' : 'pipe' })
      success('Test data seeded successfully')
    } catch (err) {
      warn('Failed to seed test data, continuing anyway...')
    }
  }
}

/**
 * Cleanup test environment
 */
function cleanupTestEnvironment(): void {
  if (!CONFIG.cleanup) {
    info('Skipping cleanup (--no-cleanup flag was set)')
    return
  }

  log('Cleaning up test environment...')

  const cleanupScript = path.join(process.cwd(), 'tests/integration/cleanup-test-data.ts')
  if (fs.existsSync(cleanupScript)) {
    try {
      execSync(`tsx ${cleanupScript}`, { stdio: CONFIG.verbose ? 'inherit' : 'pipe' })
      success('Test data cleaned up successfully')
    } catch (err) {
      warn('Failed to cleanup test data')
    }
  }
}

/**
 * Run a single test file
 */
function runTestFile(testFile: string): boolean {
  const fileName = path.basename(testFile)
  log(`Running: ${fileName}`)

  try {
    const command = `tsx ${testFile}`
    const output = execSync(command, {
      stdio: CONFIG.verbose ? 'inherit' : 'pipe',
      timeout: 60000
    })

    if (!CONFIG.verbose) {
      const outputStr = output.toString()
      if (outputStr.includes('✅') || outputStr.includes('All tests passed')) {
        success(`${fileName} passed`)
      } else {
        info(`${fileName} completed`)
      }
    }

    return true
  } catch (err: any) {
    error(`${fileName} failed`)
    if (CONFIG.verbose) {
      console.error(err.message)
    } else if (err.stdout) {
      const output = err.stdout.toString()
      if (output.includes('❌') || output.includes('failed')) {
        console.log(output)
      }
    }
    return false
  }
}

/**
 * Main test runner
 */
function runTests(): void {
  log('Starting Integration Test Runner')
  log('================================\n')

  // Discover test files
  const testFiles = discoverTestFiles()

  if (testFiles.length === 0) {
    warn('No test files found')
    process.exit(0)
  }

  log(`Found ${testFiles.length} test file(s):\n`)
  testFiles.forEach(file => {
    console.log(`  • ${path.relative(process.cwd(), file)}`)
  })

  if (CONFIG.dryRun) {
    log('\nDry run mode - no tests will be executed')
    process.exit(0)
  }

  console.log()

  // Setup environment
  setupTestEnvironment()
  console.log()

  // Run tests
  const results = {
    passed: 0,
    failed: 0,
    total: testFiles.length
  }

  for (const testFile of testFiles) {
    const passed = runTestFile(testFile)
    if (passed) {
      results.passed++
    } else {
      results.failed++
    }
  }

  // Cleanup
  console.log()
  cleanupTestEnvironment()

  // Summary
  console.log()
  log('Test Summary')
  log('============')
  console.log()
  console.log(`Total tests:  ${results.total}`)
  success(`Passed:       ${results.passed}`)
  if (results.failed > 0) {
    error(`Failed:       ${results.failed}`)
  }

  const successRate = ((results.passed / results.total) * 100).toFixed(1)
  console.log(`Success rate: ${successRate}%`)

  if (results.failed === 0) {
    console.log()
    success('🎉 All integration tests passed!')
    process.exit(0)
  } else {
    console.log()
    error('❌ Some integration tests failed')
    process.exit(1)
  }
}

// Run the test suite
try {
  runTests()
} catch (err) {
  error('Fatal error:', err)
  process.exit(1)
}
