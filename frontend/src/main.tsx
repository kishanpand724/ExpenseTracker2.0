import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import DashboardExpensePieChart from './components/DashboardExpensePieChart.tsx';
import DashboardTrendChart from './components/DashboardTrendChart.tsx';
import './index.css';

export function renderApp() {
  const analyticsContainer = document.getElementById('bklit-analytics-chart-root') || document.getElementById('root');
  if (analyticsContainer && !(analyticsContainer as any)._reactRoot) {
    const root = createRoot(analyticsContainer);
    (analyticsContainer as any)._reactRoot = root;
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  }

  const pieContainer = document.getElementById('dashboard-pie-chart-root');
  if (pieContainer && !(pieContainer as any)._reactRoot) {
    const root = createRoot(pieContainer);
    (pieContainer as any)._reactRoot = root;
    root.render(
      <StrictMode>
        <DashboardExpensePieChart />
      </StrictMode>
    );
  }

  const trendContainer = document.getElementById('dashboard-trend-chart-root');
  if (trendContainer && !(trendContainer as any)._reactRoot) {
    const root = createRoot(trendContainer);
    (trendContainer as any)._reactRoot = root;
    root.render(
      <StrictMode>
        <DashboardTrendChart />
      </StrictMode>
    );
  }
}

// Expose renderApp globally
(window as any).renderApp = renderApp;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderApp);
} else {
  renderApp();
}

window.addEventListener('transactionsUpdated', () => {
  renderApp();
  setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
});

window.addEventListener('authStateChanged', () => {
  renderApp();
  setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
});

// Ensure rendering even if script execution order varies
setTimeout(renderApp, 100);
setTimeout(renderApp, 500);
setTimeout(renderApp, 1200);
