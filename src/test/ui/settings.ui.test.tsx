import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../renderRoute';

describe('Settings UI', () => {
  it('renders all settings navigation tabs', async () => {
    renderRoute('settings');
    for (const label of ['Profile', 'Email accounts', 'General', 'Live sync', 'Appearance', 'Help']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label}$`, 'i') })).toBeInTheDocument();
    }
  });

  it('collapsible sections expand and collapse on click', async () => {
    const user = userEvent.setup();
    renderRoute('settings');

    const passwordHeader = screen.getByRole('button', { name: /change mailvault password/i });
    expect(passwordHeader).toHaveAttribute('aria-expanded', 'false');

    await user.click(passwordHeader);
    expect(passwordHeader).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();

    await user.click(passwordHeader);
    expect(passwordHeader).toHaveAttribute('aria-expanded', 'false');
  });

  it('settings search navigates to password section', async () => {
    const user = userEvent.setup();
    renderRoute('settings');

    const input = screen.getByPlaceholderText(/search settings/i);
    await user.type(input, 'password');

    const result = await screen.findByRole('option');
    expect(within(result).getByText(/change mailvault password/i)).toBeInTheDocument();

    await user.click(within(result).getByRole('button'));
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
  });

  it('profile tab shows display name and emoji picker', async () => {
    renderRoute('settings');
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    expect(screen.getByText(/emoji avatar/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /use 🦊 as avatar/i })).toBeInTheDocument();
  });

  it('switches to email accounts tab', async () => {
    const user = userEvent.setup();
    renderRoute('settings');
    await user.click(screen.getByRole('button', { name: /^email accounts$/i }));
    expect(screen.getByRole('button', { name: /linked email accounts/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect gmail/i })).toBeInTheDocument();
  });

  it('page header wraps actions on narrow viewports', () => {
    renderRoute('settings');
    const row = document.querySelector('.page-header__row');
    expect(row).toBeTruthy();
    expect(getComputedStyle(row!).flexWrap).toBe('wrap');
  });
});
