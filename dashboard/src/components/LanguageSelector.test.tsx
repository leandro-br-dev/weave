import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageSelector } from './LanguageSelector';
import i18n from '@/lib/i18n';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en-US',
      changeLanguage: vi.fn((lng: string) => {
        (i18n as any).language = lng;
        // Trigger languageChanged event
        const event = new CustomEvent('languageChanged', { detail: lng });
        window.dispatchEvent(event);
      }),
      on: vi.fn(),
      off: vi.fn(),
    },
  }),
}));

describe('LanguageSelector', () => {
  beforeEach(() => {
    // Reset to default language before each test
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<LanguageSelector />);
    expect(screen.getByRole('group')).toBeInTheDocument();
  });

  it('renders all language options', () => {
    render(<LanguageSelector />);

    expect(screen.getByLabelText(/Switch to English/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Switch to Portuguese/)).toBeInTheDocument();
  });

  it('renders flag emojis', () => {
    render(<LanguageSelector />);

    expect(screen.getByLabelText('English')).toBeInTheDocument();
    expect(screen.getByLabelText('Portuguese')).toBeInTheDocument();
  });

  it('highlights the current language as active', () => {
    render(<LanguageSelector />);

    const englishButton = screen.getByLabelText(/Switch to English/);
    expect(englishButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks non-current languages as inactive', () => {
    render(<LanguageSelector />);

    const portugueseButton = screen.getByLabelText(/Switch to Portuguese/);
    expect(portugueseButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('changes language when clicking a button', () => {
    render(<LanguageSelector />);

    const portugueseButton = screen.getByLabelText(/Switch to Portuguese/);
    fireEvent.click(portugueseButton);

    const { i18n } = require('react-i18next').useTranslation();
    expect(i18n.changeLanguage).toHaveBeenCalledWith('pt-BR');
  });

  it('applies custom className', () => {
    const { container } = render(<LanguageSelector className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders in horizontal layout when specified', () => {
    const { container } = render(<LanguageSelector layout="horizontal" />);
    expect(container.firstChild).toHaveClass('flex', 'items-center', 'gap-2');
  });

  it('renders in vertical layout by default', () => {
    const { container } = render(<LanguageSelector />);
    expect(container.firstChild).toHaveClass('flex-col', 'gap-2');
  });

  it('has proper accessibility attributes', () => {
    render(<LanguageSelector />);

    const group = screen.getByRole('group', { name: /language selector/i });
    expect(group).toBeInTheDocument();

    const englishButton = screen.getByLabelText(/Switch to English/);
    expect(englishButton).toHaveAttribute('aria-pressed');

    const portugueseButton = screen.getByLabelText(/Switch to Portuguese/);
    expect(portugueseButton).toHaveAttribute('aria-pressed');
  });

  it('shows checkmark for active language in vertical layout', () => {
    render(<LanguageSelector layout="vertical" />);

    // The Check icon should be present for the active language
    const checkIcon = document.querySelector('svg[aria-hidden="true"]');
    expect(checkIcon).toBeInTheDocument();
  });

  it('displays native language names correctly', () => {
    render(<LanguageSelector />);

    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('Português')).toBeInTheDocument();
  });

  it('displays local language names in vertical layout', () => {
    render(<LanguageSelector />);

    expect(screen.getByText('Portuguese')).toBeInTheDocument();
  });

  it('displays country codes in horizontal layout', () => {
    render(<LanguageSelector layout="horizontal" />);

    expect(screen.getByText('US')).toBeInTheDocument();
    expect(screen.getByText('BR')).toBeInTheDocument();
  });

  describe('localStorage persistence', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('persists language choice to localStorage via i18next', () => {
      render(<LanguageSelector />);

      const portugueseButton = screen.getByLabelText(/Switch to Portuguese/);
      fireEvent.click(portugueseButton);

      // Note: Actual localStorage persistence is handled by i18next's LanguageDetector
      // This test verifies that the component triggers the changeLanguage function
      const { i18n } = require('react-i18next').useTranslation();
      expect(i18n.changeLanguage).toHaveBeenCalledWith('pt-BR');
    });
  });

  describe('styling', () => {
    it('applies correct active button styles', () => {
      render(<LanguageSelector />);
      const englishButton = screen.getByLabelText(/Switch to English/);

      expect(englishButton).toHaveClass('bg-gray-900', 'text-white', 'dark:bg-gray-800');
    });

    it('applies correct inactive button styles', () => {
      render(<LanguageSelector />);
      const portugueseButton = screen.getByLabelText(/Switch to Portuguese/);

      expect(portugueseButton).toHaveClass('bg-white', 'text-gray-600', 'border-gray-300');
    });

    it('applies hover state to inactive buttons', () => {
      render(<LanguageSelector />);
      const portugueseButton = screen.getByLabelText(/Switch to Portuguese/);

      expect(portugueseButton).toHaveClass('hover:bg-gray-100');
    });
  });
});
