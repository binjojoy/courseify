import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Courseify could not start: the #root mount point is missing from index.html.');
}

// Drop the pre-hydration shell in index.html now that React is about to paint,
// rather than letting it sit behind the app for the rest of the session.
container.replaceChildren();

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register Service Worker for PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed gracefully
    });
  });
}
