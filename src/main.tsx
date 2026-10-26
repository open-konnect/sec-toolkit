import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find root mounting element.');
}

const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Build-time prerendering writes real HTML into #root. Hydrating preserves it
// for crawlers and avoids a blank first paint. The dev server starts empty.
if (rootElement.hasChildNodes()) {
  ReactDOM.hydrateRoot(rootElement, app);
} else {
  ReactDOM.createRoot(rootElement).render(app);
}
