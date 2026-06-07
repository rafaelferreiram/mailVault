import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { ALL_ROUTES, renderRoute } from '../renderRoute';

describe('Route rendering', () => {
  it.each(ALL_ROUTES)('renders %s without crashing', async (route) => {
    renderRoute(route);
    await waitFor(() => {
      expect(document.querySelector('main.app-main')).toBeTruthy();
    });
  });

  it('analyze page shows primary heading and sync controls', async () => {
    renderRoute('analyze');
    expect(await screen.findByRole('heading', { name: /analyze/i })).toBeInTheDocument();
    expect(screen.getByText(/sync window/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start analysis/i })).toBeInTheDocument();
  });

  it('settings page shows search and profile tab content', async () => {
    renderRoute('settings');
    expect(await screen.findByPlaceholderText(/search settings/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^profile$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
  });

  it('dashboard renders KPI strip when data loads', async () => {
    renderRoute('dashboard');
    await waitFor(() => {
      const strip = document.querySelector('.dashboard-kpi-strip');
      expect(strip).toBeTruthy();
      expect(screen.getByText('Total emails')).toBeInTheDocument();
      expect(screen.getByText('Storage used')).toBeInTheDocument();
    });
  });

  it('mailbox renders three-pane labels when folder is open', async () => {
    renderRoute('mailbox');
    expect(await screen.findByText(/folder tree/i)).toBeInTheDocument();
    expect(screen.getByText(/^messages$/i)).toBeInTheDocument();
    expect(screen.getByText(/^preview$/i)).toBeInTheDocument();
  });
});
