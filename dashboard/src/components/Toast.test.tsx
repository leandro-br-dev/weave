import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ToastProvider, useToast } from '@/contexts/ToastContext';

// Test component that uses the toast context
function TestComponent() {
  const { showToast, showAutoMoveToast, showError, showSuccess } = useToast();

  return (
    <div>
      <button onClick={() => showToast('info', 'Info title', 'Info message')}>
        Show Info
      </button>
      <button onClick={() => showToast('success', 'Success title', 'Success message')}>
        Show Success
      </button>
      <button onClick={() => showToast('error', 'Error title', 'Error message')}>
        Show Error
      </button>
      <button onClick={() => showAutoMoveToast('Test Task', 'Backlog', 'In Progress')}>
        Show Auto-Move
      </button>
      <button onClick={() => showError('Error title', 'Error message')}>
        Show Error (Convenience)
      </button>
      <button onClick={() => showSuccess('Success title', 'Success message')}>
        Show Success (Convenience)
      </button>
    </div>
  );
}

describe('ToastContext', () => {
  it('should show info toast', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const button = screen.getByText('Show Info');
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Info title')).toBeInTheDocument();
      expect(screen.getByText('Info message')).toBeInTheDocument();
    });
  });

  it('should show success toast', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const button = screen.getByText('Show Success');
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Success title')).toBeInTheDocument();
      expect(screen.getByText('Success message')).toBeInTheDocument();
    });
  });

  it('should show error toast', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const button = screen.getByText('Show Error');
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Error title')).toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });
  });

  it('should show auto-move toast', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const button = screen.getByText('Show Auto-Move');
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Auto-moved: Test Task')).toBeInTheDocument();
      expect(screen.getByText('Backlog → In Progress')).toBeInTheDocument();
    });
  });

  it('should show error using convenience method', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const button = screen.getByText('Show Error (Convenience)');
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Error title')).toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });
  });

  it('should show success using convenience method', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const button = screen.getByText('Show Success (Convenience)');
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Success title')).toBeInTheDocument();
      expect(screen.getByText('Success message')).toBeInTheDocument();
    });
  });

  it('should auto-dismiss toast after duration', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const button = screen.getByText('Show Info');
    await userEvent.click(button);

    // Toast should appear
    await waitFor(() => {
      expect(screen.getByText('Info title')).toBeInTheDocument();
    });

    // Toast should disappear after default duration (4000ms)
    await waitFor(
      () => {
        expect(screen.queryByText('Info title')).not.toBeInTheDocument();
      },
      { timeout: 5000 }
    );
  });

  it('should throw error when useToast is used outside provider', () => {
    // Suppress console.error for this test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useToast must be used within a ToastProvider');

    consoleError.mockRestore();
  });
});
