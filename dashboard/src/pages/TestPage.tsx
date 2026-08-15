import { useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { withDarkMode, bgColors, darkModeBgColors, borderColors, darkModeBorderColors, textColors, darkModeTextColors, accentColors, darkModeAccentColors } from '@/lib/colors'

// ── Types ────────────────────────────────────────────────────────────────────

type TestStatus = 'idle' | 'pass' | 'fail'

interface TestResult {
  name: string
  status: TestStatus
  message?: string
  duration?: number
}

// ── Component test registry ───────────────────────────────────────────────────

interface ComponentShowcase {
  id: string
  label: string
  description: string
  element: React.ReactNode
}

const showcases: ComponentShowcase[] = [
  {
    id: 'page-header-title',
    label: 'PageHeader — Title only',
    description: 'Renders with a plain title and no description or actions.',
    element: <PageHeader title="My Page Title" />,
  },
  {
    id: 'page-header-full',
    label: 'PageHeader — Full props',
    description: 'Renders with title, description, and an action button.',
    element: (
      <PageHeader
        title="Full Header"
        description="This is a sample description text."
        actions={
          <button className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-500">
            Action
          </button>
        }
      />
    ),
  },
  {
    id: 'page-header-i18n',
    label: 'PageHeader — i18n key',
    description: 'Renders using an i18nKey prop; title falls back to key when no translation exists.',
    element: <PageHeader i18nKey="pages.dashboard" />,
  },
]

// ── Automated smoke tests ─────────────────────────────────────────────────────

interface SmokeTest {
  name: string
  run: () => Promise<void> | void
}

const smokeTests: SmokeTest[] = [
  {
    name: 'localStorage read/write',
    run: () => {
      const key = '__weave_test__'
      localStorage.setItem(key, 'ok')
      const val = localStorage.getItem(key)
      localStorage.removeItem(key)
      if (val !== 'ok') throw new Error(`Expected "ok", got "${val}"`)
    },
  },
  {
    name: 'Date.now() returns a number',
    run: () => {
      const ts = Date.now()
      if (typeof ts !== 'number' || ts <= 0) throw new Error(`Invalid timestamp: ${ts}`)
    },
  },
  {
    name: 'fetch API is available',
    run: () => {
      if (typeof fetch !== 'function') throw new Error('fetch is not available in this environment')
    },
  },
  {
    name: 'WebSocket constructor exists',
    run: () => {
      if (typeof WebSocket === 'undefined') throw new Error('WebSocket is not available')
    },
  },
  {
    name: 'JSON.parse round-trip',
    run: () => {
      const obj = { a: 1, b: 'hello', c: true, d: null }
      const parsed = JSON.parse(JSON.stringify(obj))
      if (JSON.stringify(parsed) !== JSON.stringify(obj))
        throw new Error('JSON round-trip mismatch')
    },
  },
  {
    name: 'CSS custom properties readable',
    run: () => {
      const val = getComputedStyle(document.documentElement).getPropertyValue('color')
      if (typeof val !== 'string') throw new Error('Could not read CSS property')
    },
  },
  {
    name: 'Array.prototype.flat support',
    run: () => {
      const nested = [[1, 2], [3, 4]]
      const flat = nested.flat()
      if (flat.join(',') !== '1,2,3,4') throw new Error('Array.flat() produced wrong result')
    },
  },
  {
    name: 'structuredClone support',
    run: () => {
      if (typeof structuredClone !== 'function') throw new Error('structuredClone not available')
      const orig = { x: 1, nested: { y: 2 } }
      const clone = structuredClone(orig)
      if (clone === orig || clone.nested === orig.nested) throw new Error('structuredClone not deep')
    },
  },
]

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TestStatus }) {
  const map = {
    idle:   { label: '—',    cls: 'bg-gray-700 text-gray-400' },
    pass:   { label: '✓ PASS', cls: 'bg-green-900 text-green-400' },
    fail:   { label: '✗ FAIL', cls: 'bg-red-900 text-red-400' },
  }
  const { label, cls } = map[status]
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-mono font-bold ${cls}`}>
      {label}
    </span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TestPage() {
  const [results, setResults] = useState<TestResult[]>([])
  const [running, setRunning] = useState(false)
  const [activeTab, setActiveTab] = useState<'smoke' | 'components'>('smoke')

  const passed = results.filter(r => r.status === 'pass').length
  const failed = results.filter(r => r.status === 'fail').length
  const total  = results.length

  async function runAllTests() {
    setRunning(true)
    const freshResults: TestResult[] = smokeTests.map(t => ({ name: t.name, status: 'idle' as TestStatus }))
    setResults([...freshResults])

    for (let i = 0; i < smokeTests.length; i++) {
      const test = smokeTests[i]
      const t0 = performance.now()
      try {
        await test.run()
        freshResults[i] = {
          name: test.name,
          status: 'pass',
          duration: Math.round(performance.now() - t0),
        }
      } catch (err) {
        freshResults[i] = {
          name: test.name,
          status: 'fail',
          message: err instanceof Error ? err.message : String(err),
          duration: Math.round(performance.now() - t0),
        }
      }
      setResults([...freshResults])
      // Small delay so the UI updates progressively
      await new Promise(r => setTimeout(r, 80))
    }
    setRunning(false)
  }

  const tabCls = (tab: typeof activeTab) =>
    `px-4 py-2 text-sm font-semibold rounded-t-md border-b-2 transition-colors cursor-pointer select-none ${
      activeTab === tab
        ? `${withDarkMode(accentColors.text, darkModeAccentColors.textOnDark)} border-current`
        : `${withDarkMode(textColors.secondary, darkModeTextColors.muted)} border-transparent hover:${textColors.primary}`
    }`

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Test Lab"
        description="Smoke tests & component showcase for the Weave dashboard."
        actions={
          <span
            id="test-page-badge"
            className={`text-xs font-mono px-2 py-1 rounded ${withDarkMode('bg-yellow-100 text-yellow-800', 'bg-yellow-900 text-yellow-300')}`}
          >
            DEV ONLY
          </span>
        }
      />

      {/* Tabs */}
      <div className={`flex gap-1 border-b mb-6 ${withDarkMode(borderColors.default, darkModeBorderColors.default)}`}>
        <button id="tab-smoke"      className={tabCls('smoke')}      onClick={() => setActiveTab('smoke')}>
          ⚡ Smoke Tests
        </button>
        <button id="tab-components" className={tabCls('components')} onClick={() => setActiveTab('components')}>
          🧩 Components
        </button>
      </div>

      {/* ── Smoke Tests Tab ───────────────────────────────────────────── */}
      {activeTab === 'smoke' && (
        <div className="space-y-6">
          {/* Controls + summary */}
          <div className="flex items-center gap-4 flex-wrap">
            <button
              id="btn-run-tests"
              onClick={runAllTests}
              disabled={running}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${withDarkMode(accentColors.bg, accentColors.bg)} hover:opacity-90`}
            >
              {running && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              )}
              {running ? 'Running…' : '▶ Run All Tests'}
            </button>

            {total > 0 && (
              <div className="flex gap-3 text-sm font-mono">
                <span className="text-green-400">{passed} passed</span>
                {failed > 0 && <span className="text-red-400">{failed} failed</span>}
                <span className={withDarkMode(textColors.muted, darkModeTextColors.muted)}>/ {total} total</span>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {total > 0 && (
            <div className={`h-1.5 rounded-full overflow-hidden ${withDarkMode(bgColors.tertiary, darkModeBgColors.tertiary)}`}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(passed / total) * 100}%`,
                  background: failed > 0 ? '#f43f5e' : '#22c55e',
                }}
              />
            </div>
          )}

          {/* Test list */}
          <div className={`rounded-lg border divide-y overflow-hidden ${withDarkMode(`${borderColors.default} divide-gray-200`, `${darkModeBorderColors.default} divide-gray-800`)}`}>
            {smokeTests.map((test, i) => {
              const result = results[i]
              const status: TestStatus = result?.status ?? 'idle'
              return (
                <div
                  key={test.name}
                  id={`test-row-${i}`}
                  className={`flex items-start gap-4 px-4 py-3 ${withDarkMode(bgColors.secondary, darkModeBgColors.secondary)}`}
                >
                  <StatusBadge status={status} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}>
                      {test.name}
                    </p>
                    {result?.message && (
                      <p className="text-xs text-red-400 font-mono mt-0.5 truncate">{result.message}</p>
                    )}
                  </div>
                  {result?.duration != null && (
                    <span className={`text-xs font-mono shrink-0 ${withDarkMode(textColors.muted, darkModeTextColors.muted)}`}>
                      {result.duration}ms
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Components Tab ────────────────────────────────────────────── */}
      {activeTab === 'components' && (
        <div className="space-y-8">
          {showcases.map(showcase => (
            <div
              key={showcase.id}
              id={`showcase-${showcase.id}`}
              className={`rounded-lg border overflow-hidden ${withDarkMode(borderColors.default, darkModeBorderColors.default)}`}
            >
              {/* Header */}
              <div className={`px-4 py-3 border-b flex items-center justify-between ${withDarkMode(`${bgColors.tertiary} ${borderColors.default}`, `${darkModeBgColors.secondary} ${darkModeBorderColors.default}`)}`}>
                <div>
                  <p className={`text-sm font-semibold font-mono ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}>
                    {showcase.label}
                  </p>
                  <p className={`text-xs mt-0.5 ${withDarkMode(textColors.muted, darkModeTextColors.muted)}`}>
                    {showcase.description}
                  </p>
                </div>
              </div>
              {/* Preview */}
              <div className={`p-6 ${withDarkMode(bgColors.primary, darkModeBgColors.primary)}`}>
                {showcase.element}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
