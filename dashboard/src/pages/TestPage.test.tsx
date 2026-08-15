import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import TestPage from './TestPage'
import '@/lib/i18n'

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderTestPage() {
  return render(
    <MemoryRouter>
      <TestPage />
    </MemoryRouter>
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TestPage', () => {
  describe('Rendering', () => {
    it('renders the page header', () => {
      renderTestPage()
      expect(screen.getByRole('heading', { name: /test lab/i })).toBeInTheDocument()
    })

    it('renders the DEV ONLY badge', () => {
      renderTestPage()
      expect(screen.getByText(/DEV ONLY/i)).toBeInTheDocument()
    })

    it('renders smoke tests tab by default', () => {
      renderTestPage()
      expect(screen.getByRole('button', { name: /smoke tests/i })).toBeInTheDocument()
    })

    it('renders the run-all button', () => {
      renderTestPage()
      expect(screen.getByRole('button', { name: /run all tests/i })).toBeInTheDocument()
    })

    it('renders all smoke test names', () => {
      renderTestPage()
      expect(screen.getByText('localStorage read/write')).toBeInTheDocument()
      expect(screen.getByText(/Date\.now\(\)/)).toBeInTheDocument()
      expect(screen.getByText(/fetch API/)).toBeInTheDocument()
    })
  })

  describe('Tabs', () => {
    it('switches to Components tab', async () => {
      const user = userEvent.setup()
      renderTestPage()

      const componentTab = screen.getByRole('button', { name: /components/i })
      await user.click(componentTab)

      // Multiple showcases contain "PageHeader" in their label
      const pageHeaderEls = screen.getAllByText(/PageHeader/)
      expect(pageHeaderEls.length).toBeGreaterThan(0)
    })

    it('switches back to Smoke Tests tab', async () => {
      const user = userEvent.setup()
      renderTestPage()

      // Go to components
      await user.click(screen.getByRole('button', { name: /components/i }))
      // Return to smoke tests
      await user.click(screen.getByRole('button', { name: /smoke tests/i }))

      expect(screen.getByRole('button', { name: /run all tests/i })).toBeInTheDocument()
    })
  })

  describe('Smoke Tests Execution', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    it('shows "Running…" while tests are running', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderTestPage()

      const runBtn = screen.getByRole('button', { name: /run all tests/i })
      await user.click(runBtn)

      expect(screen.queryByText(/Running/i)).toBeInTheDocument()

      // Advance past all timers
      await vi.runAllTimersAsync()
    })

    it('shows pass/fail results after running', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderTestPage()

      await user.click(screen.getByRole('button', { name: /run all tests/i }))
      await vi.runAllTimersAsync()

      await waitFor(() => {
        const passBadges = screen.queryAllByText(/PASS/)
        expect(passBadges.length).toBeGreaterThan(0)
      })
    })

    it('displays total count after tests complete', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderTestPage()

      await user.click(screen.getByRole('button', { name: /run all tests/i }))
      await vi.runAllTimersAsync()

      await waitFor(() => {
        expect(screen.getByText(/passed/)).toBeInTheDocument()
      })
    })

    it('disables run button while tests are running', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderTestPage()

      const runBtn = screen.getByRole('button', { name: /run all tests/i })
      await user.click(runBtn)

      expect(runBtn).toBeDisabled()

      await vi.runAllTimersAsync()
    })
  })

  describe('Component Showcase', () => {
    it('renders PageHeader showcases in Components tab', async () => {
      const user = userEvent.setup()
      renderTestPage()

      await user.click(screen.getByRole('button', { name: /components/i }))

      expect(screen.getByText(/PageHeader — Title only/)).toBeInTheDocument()
      expect(screen.getByText(/PageHeader — Full props/)).toBeInTheDocument()
      expect(screen.getByText(/PageHeader — i18n key/)).toBeInTheDocument()
    })

    it('renders the showcase preview areas', async () => {
      const user = userEvent.setup()
      renderTestPage()

      await user.click(screen.getByRole('button', { name: /components/i }))

      // Three showcases should be rendered
      const showcaseEls = document.querySelectorAll('[id^="showcase-"]')
      expect(showcaseEls.length).toBe(3)
    })
  })
})
