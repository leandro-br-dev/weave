import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Switch } from './Switch';

describe('Switch', () => {
  it('renders correctly when unchecked', () => {
    render(<Switch checked={false} onCheckedChange={vi.fn()} />);
    const button = screen.getByRole('switch');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-checked', 'false');
  });

  it('renders correctly when checked', () => {
    render(<Switch checked={true} onCheckedChange={vi.fn()} />);
    const button = screen.getByRole('switch');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onCheckedChange when clicked', () => {
    const handleChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={handleChange} />);
    const button = screen.getByRole('switch');
    fireEvent.click(button);
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('does not call onCheckedChange when disabled and clicked', () => {
    const handleChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={handleChange} disabled={true} />);
    const button = screen.getByRole('switch');
    fireEvent.click(button);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('toggles from unchecked to checked', () => {
    const handleChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={handleChange} />);
    const button = screen.getByRole('switch');
    fireEvent.click(button);
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('toggles from checked to unchecked', () => {
    const handleChange = vi.fn();
    render(<Switch checked={true} onCheckedChange={handleChange} />);
    const button = screen.getByRole('switch');
    fireEvent.click(button);
    expect(handleChange).toHaveBeenCalledWith(false);
  });
});
