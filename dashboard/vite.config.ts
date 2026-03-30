import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

// Remove console logs in production
import removeConsole from 'vite-plugin-remove-console'

// https://vite.dev/config/
export default defineConfig((_config) => {
  // Read Cloudflare domain from environment if available
  const cloudflareDomain = process.env.CLOUDFLARE_FULL_DOMAIN

  // Build allowed hosts array
  const allowedHosts = ['localhost', '127.0.0.1']
  if (cloudflareDomain) {
    // Add the full domain and its api subdomain
    allowedHosts.push(cloudflareDomain)
    allowedHosts.push(`api-${cloudflareDomain}`)
  }

  return {
    plugins: [
      react(),
      removeConsole()
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      // Remove all console methods in production using Terser
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      } as any,
    },
    server: {
      port: 5173,
      allowedHosts, // Dynamically allow hosts from environment
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  // @ts-ignore - vitest config
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 10000,
    hookTimeout: 10000,
    isolate: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'src/test/',
        '*.config.ts',
        '*.config.js'
      ]
    },
    env: {
      NODE_ENV: 'test',
      VITE_API_URL: 'http://localhost:3001',
      VITE_API_TOKEN: 'test-token-for-testing-only',
      VITE_TEST_SERVER_PORT: '5174'
    }
  },
  }
})
