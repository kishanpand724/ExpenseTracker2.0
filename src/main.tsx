import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

function renderApp() {
  const container = document.getElementById('bklit-analytics-chart-root') || document.getElementById('root');
  if (container && !(container as any)._reactRoot) {
    const root = createRoot(container);
    (container as any)._reactRoot = root;
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderApp);
} else {
  renderApp();
}

// Ensure rendering even if script execution order varies
setTimeout(renderApp, 100);
setTimeout(renderApp, 500);
