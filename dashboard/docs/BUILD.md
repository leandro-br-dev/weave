# Build Configuration

## Console Removal in Production

All console calls (`console.log`, `console.warn`, `console.error`, `console.info`, `console.debug`) are automatically stripped from production builds. They remain active during development.

### Configuration (`vite.config.ts`)

```typescript
import removeConsole from 'vite-plugin-remove-console'

export default defineConfig({
  plugins: [
    react(),
    removeConsole()
  ],
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    } as any,
  },
})
```

### Verification

```bash
# Console works in development
npm run dev

# Console removed in production build
npm run build
grep -c "console\." dist/assets/*.js
# Expected: 0
```

### Dependencies

- `vite-plugin-remove-console` — removes console calls during bundling
- `terser` — minifier (optional in Vite 3+)
