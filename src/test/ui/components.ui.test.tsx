import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch, IosToggle } from '@/components/ui/Switch';
import { PageHeader } from '@/components/PageHeader';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { TEST_USER } from '../fixtures';

describe('Core UI components', () => {
  it('Switch toggles and uses gray track when off', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} aria-label="Test toggle" />);

    const toggle = screen.getByRole('switch', { name: /test toggle/i });
    expect(toggle.className).toMatch(/rgb/);
    expect(toggle.className).not.toContain('bg-[#34C759]');

    await user.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('Switch shows green background when checked', () => {
    render(<Switch checked={true} onChange={() => {}} aria-label="On toggle" />);
    const toggle = screen.getByRole('switch', { name: /on toggle/i });
    expect(toggle.className).toContain('bg-[#34C759]');
  });

  it('IosToggle renders label and switch', () => {
    render(<IosToggle label="Enable feature" checked={false} onChange={() => {}} />);
    expect(screen.getByText('Enable feature')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /enable feature/i })).toBeInTheDocument();
  });

  it('PageHeader supports wrapping actions', () => {
    render(
      <PageHeader
        title="Test Page"
        subtitle="Subtitle text"
        actions={<button type="button">Action A</button>}
      />
    );
    expect(screen.getByRole('heading', { name: /test page/i })).toBeInTheDocument();
    expect(document.querySelector('.page-header__row')).toBeTruthy();
  });

  it('UserAvatar renders emoji when set', () => {
    render(<UserAvatar user={{ ...TEST_USER, avatarEmoji: '🚀', avatarImage: null }} size={40} />);
    expect(screen.getByText('🚀')).toBeInTheDocument();
  });

  it('UserAvatar falls back to initials without emoji or image', () => {
    render(
      <UserAvatar
        user={{ ...TEST_USER, avatarEmoji: null, avatarImage: null, displayName: 'Test User' }}
        size={32}
      />
    );
    expect(screen.getByText('TU')).toBeInTheDocument();
  });
});
