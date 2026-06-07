import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '../index.css';
import { installMailvaultMock } from './mockMailvault';
import { resetTestStores } from './testState';

installMailvaultMock();

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);

Element.prototype.scrollIntoView = vi.fn();

afterEach(() => {
  cleanup();
  resetTestStores();
  document.documentElement.removeAttribute('data-layout');
  document.documentElement.removeAttribute('data-layout-template');
  document.documentElement.classList.remove('compact');
});
