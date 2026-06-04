import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Tag the document so platform-specific CSS (e.g. macOS traffic-lights padding,
// notch safe-area handling) can target it without an Electron preload round-trip.
if (/Mac|iPad|iPhone|iPod/i.test(navigator.userAgent)) {
  document.documentElement.classList.add('platform-mac');
}

const root = document.getElementById('root');
if (!root) throw new Error('root element missing');

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
