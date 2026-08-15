import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PageHeader } from './PageHeader'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      if (key === 'dashboard.title') return 'Dashboard Title'
      if (key === 'dashboard.description') return 'Dashboard Description'
      return options?.defaultValue || key
    },
  }),
}))

describe('PageHeader', () => {
  it('renders title and description passed via props', () => {
    render(<PageHeader title="Test Title" description="Test Description" />)
    expect(screen.getByText('Test Title')).toBeInTheDocument()
    expect(screen.getByText('Test Description')).toBeInTheDocument()
  })

  it('renders title and description from i18nKey', () => {
    render(<PageHeader i18nKey="dashboard" />)
    expect(screen.getByText('Dashboard Title')).toBeInTheDocument()
    expect(screen.getByText('Dashboard Description')).toBeInTheDocument()
  })

  it('renders actions when provided', () => {
    render(
      <PageHeader
        title="Title"
        actions={<button data-testid="action-btn">Action</button>}
      />
    )
    expect(screen.getByTestId('action-btn')).toBeInTheDocument()
  })

  it('handles missing description gracefully', () => {
    const { container } = render(<PageHeader title="Title Only" />)
    expect(screen.getByText('Title Only')).toBeInTheDocument()
    expect(container.querySelector('p')).toBeNull()
  })
})
