import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../renderRoute';

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'wide', width: 1440, height: 900 },
] as const;

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width, writable: true });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height, writable: true });
  window.dispatchEvent(new Event('resize'));
}

describe('Responsive UI', () => {
  beforeEach(() => {
    setViewport(1280, 800);
  });

  afterEach(() => {
    setViewport(1280, 800);
  });

  it.each(VIEWPORTS)('analyze renders at $name ($width px)', async ({ width, height }) => {
    setViewport(width, height);
    renderRoute('analyze');
    expect(await screen.findByRole('heading', { name: /analyze/i })).toBeInTheDocument();
    expect(screen.getByText(/sync window/i)).toBeInTheDocument();

    const stagesGrid = document.querySelector('.grid.grid-cols-1');
    expect(stagesGrid).toBeTruthy();
  });

  it.each(VIEWPORTS)('settings search is visible at $name', async ({ width, height }) => {
    setViewport(width, height);
    renderRoute('settings');
    expect(screen.getByPlaceholderText(/search settings/i)).toBeInTheDocument();
  });

  it('time range selector has horizontal scroll container', async () => {
    setViewport(390, 844);
    renderRoute('analyze');
    await screen.findByText(/sync window/i);
    expect(document.querySelector('.scroll-row')).toBeTruthy();
  });

  it('settings uses page-content padding utility', () => {
    renderRoute('settings');
    expect(document.querySelector('.page-content')).toBeTruthy();
  });

  it('dashboard grid uses responsive dashboard.css rules', () => {
    renderRoute('dashboard');
    expect(document.querySelector('.dashboard-grid')).toBeTruthy();
    expect(document.querySelector('.dashboard-kpi-strip')).toBeTruthy();
  });
});
