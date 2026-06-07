import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../renderRoute';
import { applyLayoutTemplate } from '../testState';

describe('Layout regression (master-detail template)', () => {
  beforeEach(() => {
    applyLayoutTemplate('master-detail');
  });

  function mainChildWidthRatio(route: 'analyze' | 'senders' | 'settings') {
    renderRoute(route);
    const main = document.querySelector(`main.route-${route}`)!;
    const child = main.firstElementChild as HTMLElement | null;
    expect(child).toBeTruthy();

    Object.defineProperty(main, 'clientWidth', { configurable: true, value: 1000 });
    Object.defineProperty(child!, 'clientWidth', { configurable: true, value: 980 });

    const mainWidth = main.clientWidth || 1000;
    const childWidth = child!.clientWidth || child!.offsetWidth || 980;
    return childWidth / mainWidth;
  }

  it('does not squeeze analyze content into ~38% route column', () => {
    const ratio = mainChildWidthRatio('analyze');
    expect(ratio).toBeGreaterThan(0.85);
  });

  it('does not squeeze settings content into a narrow route column', () => {
    const ratio = mainChildWidthRatio('settings');
    expect(ratio).toBeGreaterThan(0.85);
  });

  it('route main uses flex layout, not grid at the route wrapper', () => {
    renderRoute('analyze');
    const main = document.querySelector('main.route-analyze')!;
    expect(main.className).toMatch(/flex/);
    expect(getComputedStyle(main).display).not.toBe('grid');
  });

  it('analyze estimate row uses wrap-friendly layout classes', async () => {
    renderRoute('analyze');
    await screen.findByRole('heading', { name: /analyze/i });
    const wrapRow = document.querySelector('.panel-inset.flex-wrap');
    expect(wrapRow).toBeTruthy();
  });

  it('senders uses internal senders-panes grid under master-detail, not route grid', () => {
    renderRoute('senders');
    const main = document.querySelector('main.route-senders')!;
    expect(getComputedStyle(main).display).not.toBe('grid');
    const panes = document.querySelector('.senders-panes');
    expect(panes).toBeTruthy();
  });
});
