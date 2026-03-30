import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/integration/**/*.test.ts',
      'tests/integration/**/*.test.mjs'
    ],
    exclude: [
      'node_modules',
      'dist',
      'build',
      'tests/unit',
      'tests/e2e'
    ],
    setupFiles: ['./integration-setup.ts'],
    testTimeout: 60000, // Integration tests need more time
    hookTimeout: 30000,
    teardownTimeout: 15000,
    isolate: true, // Each test should be isolated
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Integration tests should run sequentially
        minThreads: 1,
        maxThreads: 1
      }
    },
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage-integration',
      exclude: [
        'node_modules/',
        'dist/',
        'build/',
        'tests/',
        '*.config.ts',
        '*.config.js',
        'tests/integration/',
        '**/*.test.ts',
        '**/*.test.mjs',
        '**/*.spec.ts',
        '**/types/**',
        '**/interfaces/**'
      ],
      // Integration tests typically have lower coverage thresholds
      // as they test interactions between components
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 55,
        statements: 60
      },
      // Track coverage for both API and client code
      all: true,
      src: ['./api/src', './client/src'],
      allowExternal: false
    },
    env: {
      NODE_ENV: 'test',
      API_URL: 'http://localhost:3001',
      AUTH_TOKEN: 'test-token-for-testing-only',
      TEST_DB_PATH: './api/data/test-database.db',
      CLEANUP_AFTER_TEST: 'true',
      SEED_TEST_DATA: 'true'
    },
    watch: false,
    sequence: {
      shuffle: false,
      concurrent: false
    }
  }
})
